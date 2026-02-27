# Sample Prompts for Demo

These prompts demonstrate the intent engine's routing behavior. Each triggers a different `IntentProfile` combination of type, severity, domain, and agent set.

Domain-specific intents (sections 1–3 below) are checked **first** and carry structured `DomainSection` data in the report. General intents follow.

---

## 1. Delayed Recon Query (Domain-specific)

Triggers `delayed_recon_query`. Routes to the **Monitoring Signal Agent** only. Returns a structured list of delayed recon job names for the resolved instance.

> Resolved instances: `INV`, `SNPB`, `FX`, `ICG`

1. **Show me delayed recon jobs for INV.**
   - Intent: `delayed_recon_query` | Severity: `high` | Instance: `INV`
   - Agents: Signal
   - Report: Delayed Recon Jobs section — `goa.cash`, `nyk.cash`, `cen.cash`

2. **What are the delayed reconciliation jobs on SNPB?**
   - Intent: `delayed_recon_query` | Severity: `medium` | Instance: `SNPB`
   - Agents: Signal

3. **List delayed recon for FX.**
   - Intent: `delayed_recon_query` | Severity: `medium` | Instance: `FX`
   - Agents: Signal

4. **Is there a recon backlog on ICG right now?**
   - Intent: `delayed_recon_query` | Severity: `medium` | Instance: `ICG`
   - Agents: Signal

---

## 2. High MTP Accounts (Domain-specific)

Triggers `high_mtp_query`. Routes to the **Monitoring Signal Agent** + **Release Validation Agent**. Returns a structured MTP table with bar indicators (yellow > threshold, red > 180).

> Default MTP threshold: `150`. SNPB has the most accounts over threshold.

5. **Show high MTP accounts for SNPB.**
   - Intent: `high_mtp_query` | Severity: `medium` | Instance: `SNPB`
   - Agents: Signal → Validation
   - Report: High MTP Accounts section — `snpb.liquidity (162)`, `snpb.fx.settlement (184)`, `snpb.derivatives (201)`

6. **Which MTP accounts are above threshold in INV?**
   - Intent: `high_mtp_query` | Severity: `medium` | Instance: `INV`
   - Agents: Signal → Validation

7. **Are there any MTP breaches in FX?**
   - Intent: `high_mtp_query` | Severity: `medium` | Instance: `FX`
   - Agents: Signal → Validation

8. **MTP issues in ICG — run a check.**
   - Intent: `high_mtp_query` | Severity: `medium` | Instance: `ICG`
   - Agents: Signal → Validation

---

## 3. Server Diagnosis (Domain-specific)

Triggers `server_diagnosis`. Routes to the **Server Health Agent** + **Dependency Intelligence Agent**. Returns CPU / Memory / Connection Pool gauges and the upstream dependency list.

> Known servers: `ICGRECON6P` (high load: CPU 78%, Mem 83%), `INVRECON3P`, `SNPBRECON2P`, `FXRECON4P`

9. **Run server diagnosis for ICGRECON6P.**
   - Intent: `server_diagnosis` | Severity: `high` | Server: `ICGRECON6P`
   - Agents: Server → Trace
   - Report: Server Diagnostics section — CPU/Mem bars + upstream dependency chips

10. **Check server health for INVRECON3P.**
    - Intent: `server_diagnosis` | Severity: `medium` | Server: `INVRECON3P`
    - Agents: Server → Trace

11. **Diagnose SNPBRECON2P.**
    - Intent: `server_diagnosis` | Severity: `medium` | Server: `SNPBRECON2P`
    - Agents: Server → Trace

12. **Server stats for FXRECON4P — is it under pressure?**
    - Intent: `server_diagnosis` | Severity: `high` | Server: `FXRECON4P`
    - Agents: Server → Trace

---

## 4. Incident Investigation

Triggers `incident_response` or `full_analysis` with `high` or `critical` severity. Routes to all three core agents.

13. **Why did yesterday's FX reconciliation fail?**
    - Intent: `full_analysis` | Severity: `high` | Domain: `FX Reconciliation`
    - Agents: Signal → Trace → Validation

14. **Analyze failed trade reconciliation from this morning.**
    - Intent: `full_analysis` | Severity: `high` | Domain: `Reconciliation`
    - Agents: Signal → Trace → Validation

15. **Investigate anomaly in payments recon — prod is affected.**
    - Intent: `anomaly_detection` | Severity: `high` | Domain: `Payment & Settlement`
    - Agents: Signal → Validation

16. **P0 incident: settlement engine is down.**
    - Intent: `incident_response` | Severity: `critical` | Domain: `Payment & Settlement`
    - Agents: Signal → Trace → Validation

17. **Critical failure in nightly batch — investigate root cause.**
    - Intent: `root_cause_trace` | Severity: `critical` | Domain: `Batch Processing`
    - Agents: Trace → Validation

---

## 5. Release Validation

Triggers `compliance_check`. Routes to the **Release Validation Agent** only.

18. **Validate today's deployment against governance policy.**
    - Intent: `compliance_check` | Severity: `medium`
    - Agents: Validation only

19. **Check if release 3.2 passed all governance checks.**
    - Intent: `compliance_check` | Severity: `medium`
    - Agents: Validation only

20. **Confirm config update applied to production meets audit requirements.**
    - Intent: `compliance_check` | Severity: `medium`
    - Agents: Validation only

---

## 6. Lineage & Trace

Triggers `root_cause_trace`. Routes to **Dependency Intelligence Agent** + **Release Validation Agent**.

21. **Show lineage for account 102 in FX recon.**
    - Intent: `root_cause_trace` | Severity: `medium` | Domain: `FX Reconciliation`
    - Agents: Trace → Validation

22. **Trace dependency chain for payment-svc.**
    - Intent: `root_cause_trace` | Severity: `medium` | Domain: `Payment & Settlement`
    - Agents: Trace → Validation

23. **Identify upstream jobs for settlement recon — last week's run.**
    - Intent: `root_cause_trace` | Severity: `low` | Domain: `Payment & Settlement`
    - Agents: Trace → Validation

---

## 7. Monitoring & Health

Triggers `anomaly_detection` or `performance_analysis`. Routes to **Monitoring Signal Agent** and optionally **Trace**.

24. **Check system health for reconciliation engines.**
    - Intent: `full_analysis` | Severity: `medium` | Domain: `Reconciliation`
    - Agents: Signal → Trace → Validation

25. **Are there active anomalies right now?**
    - Intent: `anomaly_detection` | Severity: `medium`
    - Agents: Signal → Validation

26. **Show current service degradation risks for the position management pipeline.**
    - Intent: `performance_analysis` | Severity: `medium` | Domain: `Position Management`
    - Agents: Signal → Trace

27. **Latency spike detected in market data feed — is it impacting recon?**
    - Intent: `performance_analysis` | Severity: `high` | Domain: `Market Data`
    - Agents: Signal → Trace

---

## Notes

- **Domain-specific intents (sections 1–3) are evaluated first** and take priority over general keyword matching.
- Instance/server resolution is fuzzy — `"INV"`, `"inv recon"`, and `"INVRECON3P"` all resolve to the same data record.
- Severity is additive — any prompt containing `fail`, `down`, or `prod` will escalate severity regardless of intent type.
- All simulation output is randomised per invocation (jitter applied to server stats, random pool draws for anomaly scores). The same prompt will produce varied values each run.
- `DomainSection` rich panels (bars, chips, MTP table) only render for domain-specific intents (sections 1–3).
