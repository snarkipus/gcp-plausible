import * as kubernetes from "@pulumi/kubernetes";
import { config } from "./config";

const postgresUser       = config.require("postgres-user");
const postgresPassword   = config.require("postgres-password");
const clickhouseUser     = config.require("clickhouse-user");
const clickhousePassword = config.require("clickhouse-password");

const app_name = "plausible";
const app_labels = { 
    "app.kubernetes.io/name":      "plausible",
    "app.kubernetes.io/component": "server"
};

const plausibleSvc = new kubernetes.core.v1.Service("plausible-svc", {
    metadata: {
        name: app_name,
        labels: app_labels,
    },
    spec: {
        type: "LoadBalancer",
        ports: [{
            name: "http",
            port: 8000,
            targetPort: 8000,
            protocol: "TCP",
        }],
        selector: app_labels,
    },
});

const plausibleDeploy = new kubernetes.apps.v1.Deployment("plausible-deploy", {
    metadata: {
        name: app_name,
        labels: app_labels,
    },
    spec: {
        replicas: 1,
        selector: { matchLabels: app_labels, },
        template: {
            metadata: { labels: app_labels },
            spec: {
                restartPolicy: "Always",
                securityContext: {
                    runAsUser: 1000,
                    runAsGroup: 1000,
                    fsGroup: 1000,
                },
                initContainers: [{
                    name: "plausible-init",
                    image: "plausible/analytics:latest",
                    command: ["/bin/sh", "-c"],
                    args: [`
                    sleep 30 && /entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh db init-admin
                    `],
                    envFrom: [{
                        secretRef: { name: "plausible-config" }
                    }],
                    env: [{
                        name: "POSTGRES_USER",
                        value: postgresUser,
                    }, {
                        name: "POSTGRES_PASSWORD",
                        value: postgresPassword,
                    }, {
                        name: "CLICKHOUSE_USER",
                        value: clickhouseUser,
                    }, {
                        name: "CLICKHOUSE_PASSWORD",
                        value: clickhousePassword,
                    }, {
                        name: "DATABASE_URL",
                        value: `postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(PLAUSIBLE_DB_SERVICE_HOST):$(PLAUSIBLE_DB_SERVICE_PORT)/plausible`,
                    }, {
                        name: "CLICKHOUSE_DATABASE_URL",
                        value: `http://$(CLICKHOUSE_USER):$(CLICKHOUSE_PASSWORD)@$(PLAUSIBLE_EVENTS_DB_SERVICE_HOST):$(PLAUSIBLE_EVENTS_DB_SERVICE_PORT)/plausible`,
                    }],
                    securityContext: { allowPrivilegeEscalation: false },
                    resources: {
                        limits: {
                            cpu: "1500m",
                            memory: "2Gi",
                        },
                        requests: {
                            cpu: "50m",
                            memory: "65Mi",
                        },
                    },
                }],
                containers: [{
                    name: "plausible",
                    image: "plausible/analytics:latest",
                    imagePullPolicy: "Always",
                    ports: [{ containerPort: 8000 }],
                    envFrom: [{
                        secretRef: { name: "plausible-config" },
                    }],
                    env: [{
                        name: "POSTGRES_USER",
                        value: postgresUser,
                    }, {
                        name: "POSTGRES_PASSWORD",
                        value: postgresPassword,
                    }, {
                        name: "CLICKHOUSE_USER",
                        value: clickhouseUser,
                    }, {
                        name: "CLICKHOUSE_PASSWORD",
                        value: clickhousePassword,
                    }, {
                        name: "DATABASE_URL",
                        value: `postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(PLAUSIBLE_DB_SERVICE_HOST):$(PLAUSIBLE_DB_SERVICE_PORT)/plausible`,
                    }, {
                        name: "CLICKHOUSE_DATABASE_URL",
                        value: `http://$(CLICKHOUSE_USER):$(CLICKHOUSE_PASSWORD)@$(PLAUSIBLE_EVENTS_DB_SERVICE_HOST):$(PLAUSIBLE_EVENTS_DB_SERVICE_PORT)/plausible`,
                    }],
                    securityContext: { allowPrivilegeEscalation: false },
                    resources: {
                        limits: {
                            cpu: "1500m",
                            memory: "2Gi",
                        },
                        requests: {
                            cpu: "50m",
                            memory: "150Mi",
                        },
                    },
                    readinessProbe: {
                        httpGet: {
                            path: "/api/health",
                            port: 8000,
                        },
                        initialDelaySeconds: 35,
                        periodSeconds: 10,
                        failureThreshold: 6,
                    },
                    livenessProbe: {
                        httpGet: {
                            path: "/api/health",
                            port: 8000,
                        },
                        initialDelaySeconds: 45,
                        periodSeconds: 10,
                        failureThreshold: 3,
                    },
                }],
            },
        },
    },
});

export const plausibleID = {
    ip: plausibleSvc.id,
};