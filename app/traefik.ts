import * as kubernetes from "@pulumi/kubernetes";
import { config } from "./config";

const cfiAPIEmail = config.require("cfi-api-email");
const cfiAPIKey   = config.require("cfi-api-key");

const app_name = "traefik";
const app_annotations = { 
    "app.kubernetes.io/ingress.class": "traefik",
    "traefik.ingress.kubernetes.io/router.entrypoints": "web, websecure",
    "traefik.ingress.kubernetes.io/router.tls": "true"
};

const traefikSvc = new kubernetes.helm.v3.Chart("traefik-svc", {
    chart: "traefik",
    version: "v10.21.1",
    fetchOpts: {
        repo: "https://helm.traefik.io/traefik",
    },
    values: {
        additionalArguments: [
            "--certificatesresolvers.cloudflare.acme.dnschallenge.provider=cloudflare",
            "--certificatesresolvers.cloudflare.acme.email=matt@jacksonsix.com",
            "--certificatesresolvers.cloudflare.acme.dnschallenge.resolvers=1.1.1.1",
            "--certificatesresolvers.cloudflare.acme.storage=/ssl-certs/acme-cloudflare.json",
            "--api.dashboard=true",
        ],
        logs: {
            generaL: {
                level: "ERROR",
            },
        },
        ports: {
            web: {
                redirectTo: " websecure",
            },
            websecure: {
                tls: {
                    enabled: true,
                    certResolver: "cloudflare",
                },
            }
        },
        env: [{
            name: "CF_API_EMAIL",
            value: cfiAPIEmail,
        }, {
            name: "CF_API_KEY",
            value: cfiAPIKey,
        }],
        persistence: {
            enabled: true,
            name: "ssl-certs",
            size: "1Gi",
            path: "/ssl-certs",
        },
        ingressRoute: {
            spec: {
                entryPoints: "websecure",
                routes: {
                    match: "Host(`traefik.jacksonsix.com`) && (PathPrefix(`/api`) || PathPrefix(`/dashboard`))",
                    kind: "rule",
                    services: {
                        name: "api@internal",
                        kind: "TraefikService",
                    },
                },
            },
        },
    },
});

const traefikIngress = new kubernetes.networking.v1.Ingress('traefik-ingress', {
    metadata: {
        name: app_name,
        annotations: app_annotations,
    },
    spec: {
        rules: [{
            http: {
                paths: [{
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                        service: {
                            name: "plausible",
                            port: {
                                number: 8000,
                            },
                        },
                    },                    
                }],
            },
        }],
    },
});

export const traefikID = {
    id: traefikIngress.id,
};