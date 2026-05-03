# Resource Constraints and Recommended Instances

This document summarizes the resource limits defined in `docker-compose.yml` and suggests how many instances to deploy for each service.

The current compose file is designed for a small production-like deployment. It assigns resource limits to every service, while the `deploy` section is mainly effective in Swarm or Kubernetes-style orchestration.

## Recommended Deployment Plan

| Service          | CPU Limit | Memory Limit | Recommended Instances | Notes                                                                             |
| ---------------- | --------: | -----------: | --------------------: | --------------------------------------------------------------------------------- |
| `trip-db`        |     `0.8` |       `400M` |                   `1` | Stateful PostgreSQL database. Keep a single instance unless you use replication.  |
| `user-db`        |     `0.5` |       `400M` |                   `1` | Stateful PostgreSQL database. Keep a single instance unless you use replication.  |
| `redis`          |     `0.5` |       `400M` |                   `1` | Shared cache and event support. Run one primary instance for simplicity.          |
| `rabbitmq`       |     `0.6` |       `600M` |                   `1` | Message broker. Start with one instance for this setup.                           |
| `user-service`   |     `0.6` |       `400M` |                   `2` | Stateless service. Can be scaled horizontally.                                    |
| `trip-service`   |     `0.7` |       `400M` |                   `2` | Stateless service. Can be scaled horizontally.                                    |
| `driver-service` |     `0.7` |       `400M` |                   `2` | Stateless service. Can be scaled horizontally.                                    |
| `api-gateway`    |     `0.6` |       `400M` |                   `2` | Stateless entry point. Keep at least two replicas for availability.               |
| `gateway-lb`     |     `0.4` |       `150M` |                   `1` | NGINX load balancer. One instance is enough.                                      |
| `user-haproxy`   |    `0.15` |        `80M` |                   `1` | TCP load balancer for the user service. One instance is enough.                   |
| `trip-haproxy`   |    `0.15` |        `80M` |                   `1` | TCP load balancer for the trip service. One instance is enough.                   |
| `driver-haproxy` |    `0.15` |        `80M` |                   `1` | TCP load balancer for the driver service. One instance is enough.                 |
| `prometheus`     |   not set |      not set |                   `1` | Monitoring stack component. Keep a single instance unless you need HA monitoring. |
| `grafana`        |   not set |      not set |                   `1` | Dashboard service. One instance is enough for this environment.                   |

## Practical Scaling Guidance

- Keep all stateful services at one instance unless you have configured persistence, replication, and failover.
- Scale only the stateless application services horizontally.
- A good starting point is:
  - `1` instance for each database, Redis, RabbitMQ, load balancer, Prometheus, and Grafana.
  - `2` instances for each application service: `user-service`, `trip-service`, `driver-service`, and `api-gateway`.
- If traffic grows, increase only the stateless services first, then revisit database and broker capacity.

## Notes

- `container_name` values in the compose file make simple scaling harder in plain Docker Compose.
- If you want to scale replicas cleanly, remove `container_name` and use an orchestrator such as Docker Swarm or Kubernetes.
- The limits in this file are reasonable starting points and should be adjusted after load testing and monitoring.
