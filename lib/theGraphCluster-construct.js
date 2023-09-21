// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const path = require('path')
const {
  RemovalPolicy,
  Duration,
  CustomResource,
  Stack,
  Tags,
} = require('aws-cdk-lib')
const { AutoScalingGroup } = require('aws-cdk-lib/aws-autoscaling')
const {
  Vpc,
  Peer,
  Port,
  InstanceType,
  SecurityGroup,
  SubnetType,
  LaunchTemplate,
  UserData,
  InterfaceVpcEndpointAwsService,
  EbsDeviceVolumeType,
  BlockDeviceVolume,
} = require('aws-cdk-lib/aws-ec2')
const {
  Cluster,
  EcsOptimizedImage,
  AsgCapacityProvider,
  Ec2TaskDefinition,
  LogDrivers,
  ContainerImage,
  Protocol,
  Secret,
  ContainerDependencyCondition,
  Ec2Service,
} = require('aws-cdk-lib/aws-ecs')
const {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyStatement,
  AnyPrincipal,
} = require('aws-cdk-lib/aws-iam')
const { Runtime } = require('aws-cdk-lib/aws-lambda')
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs')
const {
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraPostgresEngineVersion,
  ParameterGroup,
  ClusterInstance,
} = require('aws-cdk-lib/aws-rds')
const { Construct } = require('constructs')
const { Provider } = require('aws-cdk-lib/custom-resources')
const { FileSystem, AccessPoint } = require('aws-cdk-lib/aws-efs')
const { Bucket, BlockPublicAccess } = require('aws-cdk-lib/aws-s3')
const {
  ApplicationLoadBalancer,
  ApplicationProtocol,
} = require('aws-cdk-lib/aws-elasticloadbalancingv2')
const { NagSuppressions } = require('cdk-nag')

class TheGraphCluster extends Construct {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props)

    // Map from chainId to networkName
    const networkNames = new Map([
      [1, 'mainnet'],
      [3, 'ropsten'],
      [4, 'rinkeby'],
      [5, 'goerli'],
      [137, 'matic'],
      [80001, 'mumbai'],
      [11155111, 'sepolia'],
    ])

    const networkName = networkNames.get(props.chainId)

    // use the default VPC
    const vpc = Vpc.fromLookup(this, 'Vpc', { isDefault: true })

    // VPC Endpoint to SSM
    vpc.addInterfaceEndpoint('secretsmanagerVPCE', {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    })

    // // ALB SG open for queries from the internet to the ALB
    const albSg = new SecurityGroup(this, 'ALB-SG', {
      vpc: vpc,
      description: 'ALB SG',
    })
    Tags.of(albSg).add('Name', 'ALB-SG')

    // // The Graph SG for ECS EC2 open for IPFS p2p communication and ALB SG
    const graphServiceSg = new SecurityGroup(this, `EC2SG`, {
      vpc: vpc,
      description: 'TheGraph SG',
    })
    Tags.of(graphServiceSg).add('Name', 'TheGraph-SG')

    const dbName = 'the_graph_db'

    // Aurora serverless
    const dbEngine = DatabaseClusterEngine.auroraPostgres({
      version: AuroraPostgresEngineVersion.VER_15_2,
    })
    const dbParameterGroup = new ParameterGroup(this, 'DbParameterGroup', {
      engine: dbEngine,
      parameters: {
        client_encoding: 'UTF8',
      },
    })

    const dbInstance = new DatabaseCluster(this, 'DbCluster', {
      engine: dbEngine,
      parameterGroup: dbParameterGroup,
      removalPolicy: RemovalPolicy.DESTROY,
      vpc,
      storageEncrypted: true,
      vpcSubnets: {
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      writer: ClusterInstance.serverlessV2('dbWriter', {
        autoMinorVersionUpgrade: true,
        publiclyAccessible: false,
      }),
      readers: [
        ClusterInstance.serverlessV2('dbReader', { scaleWithWriter: true }),
      ],
      port: 5432, // postgres port
    })

    const createDBLambda = new NodejsFunction(this, 'createDBLambda', {
      entry: path.join(__dirname, '../src/lambdas', 'dbCreation.js'),
      bundling: {
        externalModules: [
          'aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
          'pg-native',
        ],
      },
      // logRetention: RetentionDays.ONE_WEEK,
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.minutes(3), // Default is 3 seconds
      memorySize: 256,
      vpc,
      allowPublicSubnet: true,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
    })
    dbInstance.secret.grantRead(createDBLambda)
    dbInstance.connections.allowDefaultPortFrom(createDBLambda)

    // Define the custom resource
    const createDBCustomResourceProvider = new Provider(
      this,
      'createDBCustomResourceProvider',
      {
        onEventHandler: createDBLambda,
        // logRetention: RetentionDays.ONE_DAY,
      }
    )

    const createDBCustomResource = new CustomResource(
      this,
      'createDBCustomResource',
      {
        serviceToken: createDBCustomResourceProvider.serviceToken,
        properties: {
          secretArn: dbInstance.secret.secretArn,
          dbName: dbName,
        },
      }
    )

    // Add a dependency to ensure that the custom resource runs after the cluster has been created
    createDBCustomResource.node.addDependency(dbInstance)

    // ECS Cluster
    const cluster = new Cluster(this, 'Ec2Cluster', {
      vpc: vpc,
      containerInsights: true,
    })

    // Persistent volume: EFS
    const fileSystem = new FileSystem(this, 'EfsFileSystem', {
      vpc,
      removalPolicy: RemovalPolicy.DESTROY,
      encrypted: true,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
    })

    fileSystem.addToResourcePolicy(
      new PolicyStatement({
        principals: [new AnyPrincipal()],
        actions: ['elasticfilesystem:ClientRootAccess'],
        resources: ['*'],
      })
    )

    const accessPoint = new AccessPoint(this, 'volumeAccessPoint', {
      fileSystem: fileSystem,
      path: '/data/ipfs',
      createAcl: {
        ownerUid: '1000',
        ownerGid: '100',
        permissions: '755',
      },
      posixUser: {
        uid: '1000',
        gid: '100',
      },
    })

    const nodeClientRole = new Role(this, 'NodeClientRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    })

    const nodeClientLaunchTemplate = new LaunchTemplate(
      this,
      'nodeClientLaunchTemplate',
      {
        machineImage: EcsOptimizedImage.amazonLinux2(),
        instanceType: new InstanceType(props.graphInstanceType),
        securityGroup: graphServiceSg,
        userData: UserData.forLinux(),
        role: nodeClientRole,
        blockDevices: [
          {
            deviceName: '/dev/xvda',
            volume: BlockDeviceVolume.ebs(30, {
              encrypted: true,
              volumeType: EbsDeviceVolumeType.GP2,
            }),
          },
        ],
      }
    )
    fileSystem.connections.allowDefaultPortFrom(nodeClientLaunchTemplate)

    const autoScalingGroup = new AutoScalingGroup(this, 'ASG', {
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
      launchTemplate: nodeClientLaunchTemplate,
      minCapacity: 1,
      maxCapacity: 1,
    })

    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.ipv4(`${props.allowedIP}/32`),
      Port.tcp(80),
      'graph queries from dev'
    )
    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.ipv4(`${props.allowedIP}/32`),
      Port.tcp(8020),
      'graph deployment from dev'
    )
    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.ipv4(`${props.allowedIP}/32`),
      Port.tcp(8030),
      'graph status queries from dev'
    )
    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.ipv4(`${props.allowedIP}/32`),
      Port.tcp(5001),
      'IPFS deployment from dev'
    )

    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.anyIpv4(),
      Port.tcp(4001),
      'IPFS P2P sync'
    )
    nodeClientLaunchTemplate.connections.allowFrom(
      Peer.anyIpv4(),
      Port.udp(4001),
      'IPFS P2P sync'
    )
    dbInstance.connections.allowDefaultPortFrom(nodeClientLaunchTemplate)

    const capacityProvider = new AsgCapacityProvider(this, 'CapacityProvider', {
      autoScalingGroup: autoScalingGroup,
      capacityProviderName: cluster.cluster_name,
      enableManagedTerminationProtection: false,
      enableManagedScaling: false,
    })

    cluster.addAsgCapacityProvider(capacityProvider)

    const efsVolumeName = 'efsDataVolume'

    const taskDefinition = new Ec2TaskDefinition(this, 'GraphNodeTaskDef', {
      volumes: [
        {
          name: efsVolumeName,
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: accessPoint.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    })

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          'elasticfilesystem:ClientRootAccess',
          'elasticfilesystem:ClientWrite',
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:DescribeMountTargets',
        ],
        resources: [fileSystem.fileSystemArn],
      })
    )

    // Creates IPFS Container
    const ipfsContainer = taskDefinition.addContainer('ipfs', {
      logging: LogDrivers.awsLogs({
        streamPrefix: 'IPFS',
        // logRetention: RetentionDays.ONE_WEEK,
      }),
      image: ContainerImage.fromRegistry('ipfs/kubo:v0.19.1'),
      memoryLimitMiB: 3072,
      healthCheck: {
        command: [
          'CMD-SHELL',
          'ipfs dag stat /ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn || exit 1',
        ],
        interval: Duration.seconds(120),
        retries: 10,
      },
      portMappings: [
        {
          containerPort: 5001,
          hostPort: 5001,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 4001,
          hostPort: 4001,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 4001,
          hostPort: 4001,
          protocol: Protocol.UDP,
        },
      ],
    })

    // Mounts the host ipfs volume onto the ipfs container
    const ipfsMountPoint = {
      containerPath: '/data/ipfs',
      sourceVolume: efsVolumeName,
      readOnly: false,
    }
    ipfsContainer.addMountPoints(ipfsMountPoint)

    const environmentVars = {
      GRAPH_LOG: props.logLevel,
      ipfs: '172.17.0.1:5001',
      ethereum: networkName + ':' + props.clientUrl,
      postgres_db: dbName,
    }

    // // Creates Graph Node Container
    const graphnodeContainer = taskDefinition.addContainer('graph-node', {
      logging: LogDrivers.awsLogs({
        streamPrefix: 'TheGraph',
        // logRetention: RetentionDays.ONE_WEEK,
      }),
      image: ContainerImage.fromRegistry('graphprotocol/graph-node:v0.30.0'),
      memoryLimitMiB: 8192,
      environment: environmentVars,
      // healthCheck: {
      //   command: ["CMD", "curl http://localhost:8040 || exit 1"],
      //   // command: ["CMD-SHELL", "curl --location 'http://localhost:8030/graphql' --header 'Content-Type: application/json' --data '{\"query\":\"{ indexingStatuses { health chains { network latestBlock {number}lastHealthyBlock { number } } } }\",\"variables\":{}}' || exit 1"],
      //   interval: Duration.seconds(300),
      //   retries: 10
      // },
      secrets: {
        postgres_host: Secret.fromSecretsManager(dbInstance.secret, 'host'),
        postgres_port: Secret.fromSecretsManager(dbInstance.secret, 'port'),
        postgres_user: Secret.fromSecretsManager(dbInstance.secret, 'username'),
        postgres_pass: Secret.fromSecretsManager(dbInstance.secret, 'password'),
      },
      portMappings: [
        {
          containerPort: 8000,
          hostPort: 80,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 8001,
          hostPort: 8001,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 8020,
          hostPort: 8020,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 8030,
          hostPort: 8030,
          protocol: Protocol.TCP,
        },
        {
          containerPort: 8040,
          hostPort: 8040,
          protocol: Protocol.TCP,
        },
      ],
    })

    graphnodeContainer.addContainerDependencies({
      container: ipfsContainer,
      condition: ContainerDependencyCondition.HEALTHY,
    })

    // access log bucket
    const accessLogsBucket = new Bucket(this, 'accessLogsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsPrefix: 'bucketaccesslogs/',
    })
    accessLogsBucket.grantPut(
      new ServicePrincipal('delivery.logs.amazonaws.com')
    )

    const service = new Ec2Service(this, 'EC2-Service', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
    })

    service.node.addDependency(createDBCustomResource)

    const alb_port80 = new ApplicationLoadBalancer(this, 'ALB-Port80', {
      vpc: vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
      dropInvalidHeaderFields: true,
    })
    alb_port80.connections.allowTo(
      graphServiceSg,
      Port.tcp(80),
      'ALB for port 80'
    )

    const listener_port80 = alb_port80.addListener('Listener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      open: false,
    })

    listener_port80.connections.addSecurityGroup(albSg)
    listener_port80.connections.allowInternally(Port.tcp(80), 'port80')

    const tg_p80 = listener_port80.addTargets('GraphECS', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targets: [autoScalingGroup],
    })

    tg_p80.configureHealthCheck({
      path: '/',
      port: '8030',
      interval: Duration.seconds(120),
      unhealthyThresholdCount: 5,
    })

    alb_port80.logAccessLogs(accessLogsBucket, 'port80')

    const alb_port8030 = new ApplicationLoadBalancer(this, 'ALB-Port8030', {
      vpc: vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
      dropInvalidHeaderFields: true,
    })

    alb_port8030.connections.allowTo(
      nodeClientLaunchTemplate,
      Port.tcp(8030),
      'ALB for port 8030'
    )

    const listener_port8030 = alb_port8030.addListener('Listener', {
      port: 8030,
      protocol: ApplicationProtocol.HTTP,
      open: false,
    })

    listener_port8030.connections.addSecurityGroup(albSg)
    listener_port8030.connections.allowInternally(Port.tcp(8030), 'port8030')

    const tg_p8030 = listener_port8030.addTargets('GraphECS', {
      port: 8030,
      protocol: ApplicationProtocol.HTTP,
      targets: [autoScalingGroup],
    })

    tg_p8030.configureHealthCheck({
      path: '/',
      port: '8030',
      interval: Duration.seconds(120),
      unhealthyThresholdCount: 5,
    })

    alb_port8030.logAccessLogs(accessLogsBucket, 'port8030')

    this.albListenerPort80 = listener_port80
    this.albListenerPort8030 = listener_port8030
    this.albPort80 = alb_port80
    this.albPort8030 = alb_port8030
    this.albSecurityGroup = albSg

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(graphServiceSg, [
      {
        id: 'AwsSolutions-EC23',
        reason: '[FP] graph node must sync IPFS data across internet via P2P',
      },
    ])

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      'TheGraphServiceStack/GraphCluster/DbCluster/Secret/Resource',
      [
        {
          id: 'AwsSolutions-SMG4',
          reason:
            '[TP-N] secrets rotation disabled because application expects secrets in env vars',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      'TheGraphServiceStack/GraphCluster/DbCluster/Resource',
      [
        {
          id: 'AwsSolutions-RDS6',
          reason:
            '[TP-C] Graph client does not support to retrieve token before DB access, compensation: Using Secrets Manager for user/password authentication',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      [
        'TheGraphServiceStack/GraphCluster/NodeClientRole/DefaultPolicy/Resource',
        '/TheGraphServiceStack/GraphCluster/createDBCustomResourceProvider/framework-onEvent/ServiceRole/DefaultPolicy/Resource',
        '/TheGraphServiceStack/GraphCluster/NodeClientRole/DefaultPolicy/Resource',
        '/TheGraphServiceStack/GraphCluster/ASG/DrainECSHook/Function/ServiceRole/DefaultPolicy/Resource',
        '/TheGraphServiceStack/GraphCluster/ASG/DrainECSHook/Function/ServiceRole/DefaultPolicy/Resource',
      ],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: '[TP-N] IAM role policy created by custom resource framework',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      'TheGraphServiceStack/GraphCluster/ASG/ASG',
      [
        {
          id: 'AwsSolutions-AS3',
          reason:
            '[FP] No Auto Scaling Group notifications required for PoC-grade deployment',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      [
        '/TheGraphServiceStack/GraphCluster/createDBCustomResourceProvider/framework-onEvent/ServiceRole/Resource',
        '/TheGraphServiceStack/GraphCluster/ASG/DrainECSHook/Function/ServiceRole/Resource',
        '/TheGraphServiceStack/GraphCluster/NodeClientRole/Resource',
        '/TheGraphServiceStack/GraphCluster/createDBLambda/ServiceRole/Resource',
      ],
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'roles created with minimal permissions by CDK',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      [
        'TheGraphServiceStack/GraphCluster/ASG/DrainECSHook/Function/Resource',
        'TheGraphServiceStack/GraphCluster/createDBCustomResourceProvider/framework-onEvent/Resource',
      ],
      [
        {
          id: 'AwsSolutions-L1',
          reason:
            '[TP-C] lambda function autogenerated, using the latest CDK version',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      'TheGraphServiceStack/GraphCluster/ASG/LifecycleHookDrainHook/Topic/Resource',
      [
        {
          id: 'AwsSolutions-SNS2',
          reason:
            '[FP] No server-side encryption needed for required for PoC-grade deployment',
        },
        {
          id: 'AwsSolutions-SNS3',
          reason: '[FP] No SSL encryption needed for PoC-grade deployment',
        },
      ]
    )

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      'TheGraphServiceStack/GraphCluster/GraphNodeTaskDef/Resource',
      [
        {
          id: 'AwsSolutions-ECS2',
          reason:
            '[FP] only non-sensitive data are passed in as environment variables, secrets only via secrets',
        },
      ]
    )
  }
}

module.exports = { TheGraphCluster }
