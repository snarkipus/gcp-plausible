import * as kubernetes from "@pulumi/kubernetes";
import { config } from './config';

const postgresUser     = config.require("postgres-user");
const postgresPassword = config.require("postgres-password");

const db_name = "plausible-db";
const db_labels = {
    "app.kubernetes.io/name":      "postgres",
    "app.kubernetes.io/component": "database",
    "app.kubernetes.io/part-of":   "plausible"
};

const postgresSvc = new kubernetes.core.v1.Service("postgres-svc", {
    metadata: {
        name: db_name,
        labels: db_labels,
    },
    spec: {
        type: "ClusterIP",
        ports: [{
            name: "db",
            port: 5432,
            targetPort: 5432,
            protocol: "TCP",
        }],
        selector: db_labels,
    }
});

const postgresSet = new kubernetes.apps.v1.StatefulSet("postgres-set", {
    metadata: {
        name: db_name,
        labels: db_labels,
    },
    spec: {
        serviceName: db_name,
        replicas: 1,
        selector: { matchLabels: db_labels },
        template: {
            metadata: { labels: db_labels },
            spec: {
                restartPolicy: "Always",
                securityContext: {
                    runAsUser: 999,
                    runAsGroup: 999,
                    fsGroup: 999,
                },
                containers: [{
                    name: db_name,
                    image: "postgres:latest",
                    imagePullPolicy: "Always",
                    ports: [{ containerPort: 5432 }],
                    volumeMounts: [{
                        name: "data",
                        mountPath: "/var/lib/postgresql/data",
                    }],
                    env: [{
                        name: "POSTGRES_DB",
                        value: "plausible",
                    }, {
                        name: "PGDATA",
                        value: "/var/lib/postgresql/pgdata",
                    }, {
                        name: "POSTGRES_USER",
                        value: postgresUser,
                    }, {
                        name: "POSTGRES_PASSWORD",
                        value: postgresPassword,
                    }],
                    securityContext: { allowPrivilegeEscalation: false },
                    resources: {
                        limits: {
                            cpu: "1500m",
                            memory: "2Gi",
                        },
                        requests: {
                            cpu: "15m",
                            memory: "65Mi",
                        },
                    },
                    readinessProbe: {
                        exec: {
                            command: [
                                "/bin/sh",
                                "-c",
                                "pg_isready -U postgres",
                            ],
                        },
                        initialDelaySeconds: 20,
                        periodSeconds: 10,
                        failureThreshold: 6,
                    },
                    livenessProbe: {
                        exec: {
                            command: [
                                "/bin/sh",
                                "-c",
                                "pg_isready -U postgres",
                            ],
                        },
                        initialDelaySeconds: 30,
                        periodSeconds: 10,
                        failureThreshold: 3,
                    },
                }],
            },
        },
        volumeClaimTemplates: [{
            metadata: {
                name: "data",
                labels: db_labels,
            },
            spec: {
                accessModes: ["ReadWriteOnce"],
                resources: {
                    requests: { storage: "128Mi" },
                    limits: { storage: "15Gi" },
                },
            },
        }],
    },
});

export const postgresID = {
    id: postgresSvc.id,
};