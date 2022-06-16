import * as kubernetes from "@pulumi/kubernetes";
import { config } from './config';

const clickhouseUser     = config.require("clickhouse-user");
const clickhousePassword = config.require("clickhouse-password");

const eventsdb_name = "plausible-events-db";
const eventsdb_labels = { 
    "app.kubernetes.io/name":      "clickhouse",
    "app.kubernetes.io/component": "database",
    "app.kubernetes.io/part-of":   "plausible"
};

const clickhouseSvc = new kubernetes.core.v1.Service("clickhouse-svc", {
    metadata: {
        name: eventsdb_name,
        labels: eventsdb_labels,
    },
    spec: {
        type: "ClusterIP",
        ports: [{
            name: "db",
            port: 8123,
            targetPort: 8123,
            protocol: "TCP",
        }],
        selector: eventsdb_labels,
    },
});

const clickhouseMap = new kubernetes.core.v1.ConfigMap("clickhouse-map", {
    metadata: {
        name: "plausible-events-db-config",
    },
    data: {
        "clickhouse-config.xml": `
        <yandex>
            <logger>
                <level>warning</level>
                <console>true</console>
            </logger>

            <!-- Stop all the unnecessary logging -->
            <query_thread_log remove="remove"/>
            <query_log remove="remove"/>
            <text_log remove="remove"/>
            <trace_log remove="remove"/>
            <metric_log remove="remove"/>
            <asynchronous_metric_log remove="remove"/>
        </yandex>`,
        "clickhouse-user-config.xml": `
        <yandex>
            <profiles>
                <default>
                    <log_queries>0</log_queries>
                    <log_query_threads>0</log_query_threads>
                </default>
            </profiles>
        </yandex>`,
    },
});

const clickhouseSet = new kubernetes.apps.v1.StatefulSet("clickhouse-set", {
    metadata: {
        name: eventsdb_name,
        labels: eventsdb_labels,
    },
    spec: {
        serviceName: eventsdb_name,
        replicas: 1,
        selector: { matchLabels: eventsdb_labels },
        template: {
            metadata: { labels: eventsdb_labels },
            spec: {
                restartPolicy: "Always",
                securityContext: {
                    runAsUser: 101,
                    runAsGroup: 101,
                    fsGroup: 101,
                },
                containers: [{
                    name: eventsdb_name,
                    image: "yandex/clickhouse-server:latest",
                    imagePullPolicy: "Always",
                    ports: [{ containerPort: 8123 }],
                    volumeMounts: [{
                        name: "data",
                        mountPath: "/var/lib/clickhouse",
                    }, {
                        name: "config",
                        mountPath: "/etc/clickhouse-server/config.d/logging.xml",
                        subPath: "clickhouse-config.xml",
                        readOnly: true,
                    }, {
                        name: "config",
                        mountPath: "/etc/clickhouse-server/users.d/logging.xml",
                        subPath: "clickhouse-user-config.xml",
                        readOnly: true,
                    }],
                    env: [{
                        name: "CLICKHOUSE_DB",
                        value: "plausible",
                    }, {
                        name: "CLICKHOUSE_USER",
                        value: clickhouseUser,
                    }, {
                        name: "CLICKHOUSE_PASSWORD",
                        value: clickhousePassword,
                    }],
                    securityContext: { allowPrivilegeEscalation: false },
                    resources: {
                        limits: {
                            cpu: "1500m",
                            memory: "2Gi",
                        },
                        requests: {
                            cpu: "10m",
                            memory: "80Mi",
                        },
                    },
                    readinessProbe: {
                        httpGet: {
                            path: "/ping",
                            port: 8123,
                        },
                        initialDelaySeconds: 20,
                        periodSeconds: 10,
                        failureThreshold: 6,
                    },
                    livenessProbe: {
                        httpGet: {
                            path: "/ping",
                            port: 8123,
                        },
                        initialDelaySeconds: 30,
                        periodSeconds: 10,
                        failureThreshold: 3,
                    },
                }],
                volumes: [{
                    name: "config",
                    configMap: {
                        name: "plausible-events-db-config",
                    },
                }],
            },
        },
        volumeClaimTemplates: [{
            metadata: {
                name: "data",
                labels: eventsdb_labels,
            },
            spec: {
                accessModes: ["ReadWriteOnce"],
                resources: {
                    requests: { storage: "128Mi" },
                    limits: { storage: "20Gi" },
                },
            },
        }],
    },
});

export const clickhouseID = {
    id: clickhouseSvc.id,
};