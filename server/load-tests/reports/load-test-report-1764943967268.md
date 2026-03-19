# Load Test Report

**Generated:** 2025-12-05T14:12:47.268Z

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Endpoints Tested | 4 |
| Total Requests | 13,344 |
| Average Latency | 89.13ms |
| Error Rate | 0.0000% |
| Max RPS Achieved | 829 |
| WebSocket Connections | 0/0 |

## Public Endpoints

| Endpoint | Method | RPS | Avg Latency | p99 Latency | Errors |
|----------|--------|-----|-------------|-------------|--------|
| /api/health | GET | 754 | 66.0ms | 193.0ms | 0 |
| /api/public/homepage-content | GET | 794 | 62.5ms | 183.0ms | 0 |
| /api/announcements | GET | 829 | 59.5ms | 186.0ms | 0 |
| /api/vacancies | GET | 292 | 168.6ms | 392.0ms | 0 |

## Authenticated Endpoints

## WebSocket Performance

| Role | Connections | Success Rate | Avg Latency | p99 Latency |
|------|-------------|--------------|-------------|-------------|

## Recommendations

- COMPRESSION: Enable gzip/brotli compression for API responses.
- CDN: Serve static assets through a CDN to reduce server load.
- MONITORING: Set up APM tools (DataDog, New Relic) for production monitoring.
- LOAD BALANCING: Deploy multiple instances behind a load balancer for 500+ concurrent users.

## Test Environment

- **Date:** 12/5/2025
- **Platform:** Node.js v20.19.3
- **Memory:** 19MB used
