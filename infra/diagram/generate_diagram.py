from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import CloudFront, InternetGateway, ALB, NATGateway
from diagrams.aws.compute import ECS, Lambda, EC2AutoScaling, ECR
from diagrams.aws.security import Cognito
from diagrams.aws.database import Dynamodb
from diagrams.aws.storage import S3
from diagrams.aws.devtools import Codepipeline
from diagrams.aws.integration import Eventbridge, SQS, SNS, StepFunctions
from diagrams.aws.management import Cloudwatch, CloudwatchAlarm, ParameterStore
from diagrams.aws.general import Users

OUTPUT = "/Users/ghorabas/mini-jira-aws/infra/diagram/mini_jira_architecture_generated"

graph_attr = {
    "fontsize": "11",
    "bgcolor": "white",
    "pad": "1.2",
    "splines": "ortho",
    "nodesep": "0.6",
    "ranksep": "0.8",
    "fontname": "Sans-Serif",
}


def c(bg, pen, fs="11"):
    return {"bgcolor": bg, "pencolor": pen, "fontsize": fs, "fontname": "Sans-Serif"}


# ── invisible rank-enforcing edge helper ──────────────────────────────────────
invis  = {"style": "invis"}
norank = {"constraint": "false"}   # visible edge that doesn't affect rank


with Diagram(
    "Mini Jira on AWS — High Availability Architecture",
    filename=OUTPUT,
    outformat="png",
    show=False,
    direction="TB",
    graph_attr=graph_attr,
):
    # ── above the AWS cloud ───────────────────────────────────────────────────
    users = Users("End Users")
    cf    = CloudFront("CloudFront\nCDN / Edge")

    with Cluster("AWS Cloud", graph_attr=c("#e8f4fd", "#90caf9", "13")):

        with Cluster("Region: account-1", graph_attr=c("#deeeff", "#64b5f6", "12")):
            igw = InternetGateway("Internet Gateway")

            # ── VPC ───────────────────────────────────────────────────────────
            with Cluster("VPC Service Level", graph_attr=c("#e8f5e9", "#66bb6a", "12")):

                with Cluster("Public Subnets", graph_attr=c("#e0f7fa", "#26c6da", "11")):
                    with Cluster("Public Subnet AZ-a\nAZ-a", graph_attr=c("#b2ebf2", "#00acc1")):
                        nat   = NATGateway("NAT Gateway\nAZ-a")
                        alb_a = ALB("ALB Router\nAZ-a")
                        alb_a2 = ALB("ALB Router\nAZ-a + 1")

                    with Cluster("Public Subnet AZ-b\nAZ-b+4", graph_attr=c("#b2ebf2", "#00acc1")):
                        alb_b = ALB("ALB Router\nAZ-b")
                        asg   = EC2AutoScaling("Auto Scaling\nAZ-b + EC2")

                with Cluster("Private Subnets", graph_attr=c("#ede7f6", "#9575cd", "11")):
                    with Cluster("Private Subnet AZ-a\nAZ-a", graph_attr=c("#d1c4e9", "#7e57c2")):
                        ecs_a = ECS("ECS Fargate AZ-a\nPort 80 / 443")
                    with Cluster("Private Subnet AZ-b\nAZ-b+4", graph_attr=c("#d1c4e9", "#7e57c2")):
                        ecs_b = ECS("ECS Fargate AZ-b\nPort 80 / 443")

            # ── Manager Services ──────────────────────────────────────────────
            with Cluster("Manager Services — aws-services", graph_attr=c("#e3f2fd", "#1e88e5", "12")):

                with Cluster("Build & Deploy", graph_attr=c("#fce4ec", "#e91e63", "11")):
                    pipeline = Codepipeline("CodePipeline\nCI/CD pipeline")
                    ecr      = ECR("ECR Container\nRegistry")
                    param    = ParameterStore("AWS Parameter\nStore / Config")

                with Cluster("Event-Driven Pipeline", graph_attr=c("#e8f5e9", "#43a047", "11")):
                    eb        = Eventbridge("EventBridge\nFrom Bus")
                    l_trigger = Lambda("Lambda\nEvent Trigger")
                    sf        = StepFunctions("Step Functions\nTask Manager")
                    l_task    = Lambda("Lambda\nTask Manager")
                    sqs_q     = SQS("SQS Queue\n(FIFO)")
                    l_img     = Lambda("Lambda\nImage Processing")
                    l_fe      = Lambda("Lambda\nPCP Frontend")

            # ── Data Layer ────────────────────────────────────────────────────
            with Cluster("Data Layer", graph_attr=c("#fffde7", "#ffb300", "12")):
                db_tasks  = Dynamodb("DynamoDB\nTask Events")
                db_users  = Dynamodb("DynamoDB\nTask Events (2)")
                s3_assets = S3("S3 Backup\nFrontend assets\npipeline")
                s3_tasks  = S3("S3 Backup\nTask pipeline\n(events backup)")
                s3_ver    = S3("S3 Version\nBackup")

            # ── Observability ─────────────────────────────────────────────────
            with Cluster("Observability", graph_attr=c("#f3e5f5", "#8e24aa", "12")):
                cw       = Cloudwatch("CloudWatch\nLogs & Metrics")
                cw_alarm = CloudwatchAlarm("CloudWatch\nAlarms")
                sns      = SNS("SNS\nNotify Ops (alarm)")

    # ═════════════════════════ EDGES ═════════════════════════════════════════

    # ── main rank chain (drives top-to-bottom layout) ─────────────────────────
    # Users → CF → IGW → VPC public → VPC private → Event Pipeline → Data Layer
    users >> Edge(label="HTTPS")                            >> cf
    cf    >> Edge(label="HTTPS (routes static\nfiles via app)") >> igw
    igw   >> Edge(label="address")                          >> alb_a
    alb_a >> Edge(label="address")                          >> ecs_a
    ecs_a >> Edge(label="just notify")                      >> eb
    eb    >> l_trigger >> sf >> l_task >> sqs_q >> l_img >> l_fe

    # Event Pipeline → Data Layer (rank-constraining)
    l_task >> Edge(label="Publish assignment event")         >> db_tasks

    # Data Layer → Observability (invisible, rank only)
    db_tasks >> Edge(**invis)                                >> cw
    cw       >> Edge(label="alarm")                          >> cw_alarm
    cw_alarm >> sns

    # ── secondary VPC connections (no rank impact) ────────────────────────────
    igw   >> Edge(label="address+1", **norank)               >> alb_b
    alb_a2 >> Edge(label="address",  **norank)               >> ecs_a
    alb_b  >> Edge(label="address+1", **norank)              >> ecs_b
    asg    >> Edge(label="private traffic", **norank)        >> ecs_b
    ecs_a  >> Edge(label="outbound",  **norank)              >> nat
    ecs_b  >> Edge(label="outbound",  **norank)              >> nat

    # ── CI / CD → VPC (no rank impact — prevents pulling Manager above VPC) ───
    pipeline >> ecr
    ecr   >> Edge(label="pull image", **norank)              >> ecs_a
    ecr   >> Edge(label="pull image", **norank)              >> ecs_b
    param >> Edge(label="env config", **norank)              >> ecs_a
    param >> Edge(label="env config", **norank)              >> ecs_b

    # ── event pipeline → data layer (additional, no rank) ────────────────────
    sf     >> Edge(label="Publish assignment event", **norank) >> db_users
    l_task >> Edge(label="Publish assignment event", **norank) >> db_users

    # ── VPC CRUD → data layer (no rank impact) ───────────────────────────────
    ecs_a >> Edge(label="CRUD", **norank)                    >> db_tasks
    ecs_b >> Edge(label="CRUD", **norank)                    >> db_users

    # ── image / asset storage ─────────────────────────────────────────────────
    l_img >> Edge(label="PUT image", **norank)               >> s3_assets
    ecs_a >> Edge(label="PUT image", **norank)               >> s3_tasks
    ecs_b >> Edge(label="PUT image", **norank)               >> s3_ver

    # ── observability feeds (no rank impact) ─────────────────────────────────
    ecs_a  >> Edge(**norank) >> cw
    ecs_b  >> Edge(**norank) >> cw
    l_task >> Edge(**norank) >> cw


print("Diagram written →", OUTPUT + ".png")
