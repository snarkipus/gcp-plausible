<div id="top"></div>

<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

</div>

<br />
<div align="center">
  <a href="https://github.com/snarkipus/gcp-plausible">
    <img src="docs/imgs/gcp-plausible.png" alt="silly logo" width="720">
  </a>

<h2 align="center">Self-Hosted Plausible Analytics</h2>

  <p align="center">
    Plausibe Analytics hosted on the Google Cloud Platform
    <br />
    <a href="https://github.com/snarkipus/gcp-plausible/issues">Report Bug</a>
    ·
    <a href="https://github.com/snarkipus/gcp-plausible/issues">Request Feature</a>
  </p>
</div>

## DISCLAIMER
This was a largely academic exercise intended to learn a about cloud technology and infrastructure. If you utilize this self-hosting solution for Plausible Analytics, PLEASE make an effort to support them by either using their hosted solution or contributing to their project. 

## About
Self-hosted, privacy focused web analytics deployed to Kubernetes on the Google Cloud Platform. Built using Pulumi (TypeScript), an open source Infrastructure as Code framework.
<div align="center">
<img alt="Plausible Screenshot" src="./docs/imgs/privacy-focused-web-analytics.png" width="720">
</div>
<p align="right">(<a href="#top">back to top</a>)</p>

### Features
- [Plausible Analytics](https://plausible.io/): lightweight and open source web analytics (no cookies) and fully compliant with GDPR, CCPA and PECR
  - NOTE:
    - SMTP server _not configured_
    - MaxMind IP Geolocation _not configured_ (TODO) 
- [Traefik Proxy](https://traefik.io/traefik/): leading modern reverse proxy and load balancer that makes deploying microservices easy
  - SSL Termination
  - [Cloudflare](https://www.cloudflare.com/) integration
- [Pulumi](https://www.pulumi.com/): build, deploy, and manage cloud applications and infrastructure using  the power of familiar programming languages and tooling
- [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine): automated and scalable managed Kubernetes platform
  - Single-click clusters which can scale up to 15,000 nodes (four-way autoscaling)
  - High-availability control plane including multi-zonal and regional clusters
  - Secure: container image vulnerability scanning and data encryption
  - [_Autopilot Mode_](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview): hands-off, fully managed solution that manages the entire cluster’s infrastructure without worrying about configuring and monitoring 

### Infrastructure Dashboards
![Project Dashboards](./docs/imgs/dashboards.png)
<p align="right">(<a href="#top">back to top</a>)</p>

## Getting Started

### Prerequisites
- [Pulumi](https://www.pulumi.com/docs/get-started/install/)
  ```bash
  $ pulumi version
  v3.34.1
  ```
- [Google Cloud SDK and Command Line Interface](https://cloud.google.com/sdk/docs/install)
  ```bash
  $ gcloud --version
  Google Cloud SDK 390.0.0
  alpha 2022.06.10
  beta 2022.06.10
  bq 2.0.75
  bundled-python3-unix 3.9.12
  core 2022.06.10
  gsutil 5.10
  ```
- Configured Google Cloud Platform (GCP) project w/Google Kubernetes Engine (GKE) API enabled
  ```bash
  $ gcloud config list
  [compute]
  region = us-central1
  [core]
  account = someone@someplace.com
  disable_usage_reporting = True
  project = project-name-here
  ```
  ```bash
  $ gcloud services list | grep Kubernetes
  container.googleapis.com            Kubernetes Engine API  
  ```
- Node and Node Package Management (yarn or npm)
  ```bash
  $ node -v && npm -v && yarn -v
  v16.14.0
  8.12.1
  1.22.19
  ```
<p align="right">(<a href="#top">back to top</a>)</p>

### Installation
1. Clone the repo
   ```bash
   $ git clone https://github.com/snarkipus/gcp-plausible
   ```
2. Install the node package manager
   ```bash
   $ cd gcp-plausible && yarn install
   ```
### Build and Deploy the cluster (needs testing)
NOTE: This works for me - someone who is 'not' me might need to figure out how pulumi handles things like secrets. Hopefully somebody will let me know if my cloudflare credentials are exposed ...
1. Verify the pulumi configuration file
   ```bash
   $ pulumi config --show-secrets
   Please choose a stack, or create a new one: alpha
   KEY                  VALUE
   gcp:project          project-name-here
   cfi-api-email        someone@someplace.com
   cfi-api-key          U5Mb9IROTUJ0btByIsMlkIuTxZ7qdFh4T7Ov
   clickhouse-password  anotherpassword
   clickhouse-user      clickhouse
   gke-min-version      1.22
   postgres-password    somepassword
   postgres-user        postgres
   ```
   - Ensure that `project-name-here` matches the gcloud configuration
   - `cfi-api-email` and `cfi-api-key` will need to be updated to match your cloudflare credentials
2. Comment out all lines except `export * from './gcp/index';` in `index.ts` (we're only building the infrastructure)
   NOTE: I'm sure there's an intelligent way to do this in one step - feel free to do smart things.
3. Preview the configuration
   ```bash
   $ pulumi preview
   ```
4. If everything looks good, build the cluster (takes ~5 minutes)
   ```bash
   $ pulumi up
   ```
<p align="right">(<a href="#top">back to top</a>)</p>

### Deploy the applications
NOTE: I did this in steps which may not (and most likely shouldn't be) necessary
1. Get credentials to deploy the applications to the cluster
   NOTE: I'm sure there's a way to programmatically do this - I just don't know it.
   ```bash
    gcloud container clusters get-credentials primary-alpha --zone=us-central1
    ```
2. Uncomment `export * from './app/plausible-db';` in `index.ts`
3. Deploy `plausible-db` (postgres)
   ```bash
   $ pulumi update 
   ```
4. Once successful, uncomment  `export * from './app/plausible-events-db';`
5. Deploy `plausible-events-db` (clickhouse) via `pulumi update`.
6. Create your plausible-conf.env file (full details [here](https://plausible.io/docs/self-hosting-configuration) - [Example here](https://www.digitalocean.com/community/tutorials/how-to-install-plausible-analytics-on-ubuntu-20-04)):
   ```env
   ADMIN_USER_EMAIL=your_email_here
   ADMIN_USER_NAME=admin_username
   ADMIN_USER_PWD=admin_password
   BASE_URL=https://your_domain_here
   SECRET_KEY_BASE=paste_your_random_characters_here
   ```
7. Create kubernetes secret from the plausible-conf.env file
   ```bash
   $ kubectl create secret generic plausible-config --from-env-file=plausible-conf.env
   ```
8. Uncomment `export * from './app/plausible';` in `index.ts`
9. Deploy the `plausible` application via `pulumi update`.
   NOTE: this defaults to `ClusterIP` since I used Traefik as a reverse proxy/load balancer. If that isn't required, then you can change the type to `LoadBalancer` in `app/plausible.ts`.
10. (Optional: Traefik w/Cloudflare Integration) Update the `cfi-api-email` and `cfi-api-key` to reflect your needs:
    ```bash
    $ pulumi config set --secret cfi-api-email someone@somewhere.com
    $ pulumi config set --secret cfi-api-key long-hex-string-goes-here
    ```
11. (Optional: Traefik w/Cloudflare Integration) uncomment `export * from './app/traefik';` in `index.ts`
12. (Optional: Traefik w/Cloudflare Integration) deploy Traefik via `pulumi update`
<p align="right">(<a href="#top">back to top</a>)</p>

### Usage
If everything went well, then you should have the applications deployed and your plausible analytics interface should be available at whatever subdomain you specified in your DNS settings (e.g. plausible.example.com). Just copy the javascript snippet into the head of your site and metrics should begin populating.
<p align="right">(<a href="#top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>

## Contact

Matt Jackson - [@snarkipus](https://twitter.com/snarkipus) - matt@jacksonsix.com

Project Link: [https://github.com/snarkipus/gcp-plausible](https://github.com/snarkipus/gcp-plausible)

<p align="right">(<a href="#top">back to top</a>)</p>

[contributors-shield]: https://img.shields.io/github/contributors/snarkipus/gcp-plausible.svg?style=for-the-badge
[contributors-url]: https://github.com/snarkipus/gcp-plausible/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/snarkipus/gcp-plausible.svg?style=for-the-badge
[forks-url]: https://github.com/snarkipus/gcp-plausible/network/members
[stars-shield]: https://img.shields.io/github/stars/snarkipus/gcp-plausible.svg?style=for-the-badge
[stars-url]: https://github.com/snarkipus/gcp-plausible/stargazers
[issues-shield]: https://img.shields.io/github/issues/snarkipus/gcp-plausible.svg?style=for-the-badge
[issues-url]: https://github.com/snarkipus/gcp-plausible/issues
[license-shield]: https://img.shields.io/github/license/snarkipus/gcp-plausible.svg?style=for-the-badge
[license-url]: https://github.com/snarkipus/gcp-plausible/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/snarkipus