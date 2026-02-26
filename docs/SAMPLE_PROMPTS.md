# Sample Prompts for Demo

These prompts demonstrate the intent engine's routing behavior. Each triggers a different `IntentProfile` combination of type, severity, domain, and agent set.

---

## Incident Investigation

Triggers `incident_response` or `full_analysis` intent with `high` or `critical` severity. Routes to all three agents.

1. **Why did yesterday's FX reconciliation fail?**
   - Intent: `full_analysis` | Severity: `high` | Domain: `FX Reconciliation`
   - Agents: Signal → Trace → Validation

2. **Analyze failed trade reconciliation from this morning.**
   - Intent: `full_analysis` | Severity: `high` | Domain: `Reconciliation`
   - Agents: Signal → Trace → Validation

3. **Investigate anomaly in payments recon — prod is affected.**
   - Intent: `anomaly_detection` | Severity: `high` | Domain: `Payment & Settlement`
   - Agents: Signal → Validation

4. **P0 incident: settlement engine is down.**
   - Intent: `incident_response` | Severity: `critical` | Domain: `Payment & Settlement`
   - Agents: Signal → Trace → Validation

5. **Critical failure in nightly batch — investigate root cause.**
   - Intent: `root_cause_trace` | Severity: `critical` | Domain: `Batch Processing`
   - Agents: Trace → Validation

---

## Release Validation

Triggers `compliance_check` intent. Routes primarily to the Release Validation Agent.

6. **Validate today's deployment against governance policy.**
   - Intent: `compliance_check` | Severity: `medium`
   - Agents: Validation only

7. **Check if release 3.2 passed all governance checks.**
   - Intent: `compliance_check` | Severity: `medium`
   - Agents: Validation only

8. **Confirm config update applied to production meets audit requirements.**
   - Intent: `compliance_check` | Severity: `medium`
   - Agents: Validation only

---

## Lineage & Trace

Triggers `root_cause_trace` intent. Routes to Dependency Intelligence Agent and Release Validation Agent.

9. **Show lineage for account 102 in FX recon.**
   - Intent: `root_cause_trace` | Severity: `medium` | Domain: `FX Reconciliation`
   - Agents: Trace → Validation

10. **Trace dependency chain for payment-svc.**
    - Intent: `root_cause_trace` | Severity: `medium` | Domain: `Payment & Settlement`
    - Agents: Trace → Validation

11. **Identify upstream jobs for settlement recon — last week's run.**
    - Intent: `root_cause_trace` | Severity: `low` | Domain: `Payment & Settlement`
    - Agents: Trace → Validation

---

## Monitoring & Health

Triggers `anomaly_detection` or `performance_analysis` intent. Routes to Monitoring Agent and optionally Trace.

12. **Check system health for reconciliation engines.**
    - Intent: `full_analysis` | Severity: `medium` | Domain: `Reconciliation`
    - Agents: Signal → Trace → Validation

13. **Are there active anomalies right now?**
    - Intent: `anomaly_detection` | Severity: `medium`
    - Agents: Signal → Validation

14. **Show current service degradation risks for the position management pipeline.**
    - Intent: `performance_analysis` | Severity: `medium` | Domain: `Position Management`
    - Agents: Signal → Trace

15. **Latency spike detected in market data feed — is it impacting recon?**
    - Intent: `performance_analysis` | Severity: `high` | Domain: `Market Data`
    - Agents: Signal → Trace

---

## Notes

- Exact agent routing depends on keyword matching priority in `IntentAnalyzer`. Slight wording variations may shift the detected `IntentType`.
- Severity is additive — a `full_analysis` prompt with `fail` in the text will carry `high` severity regardless of intent type.
- All simulation output is randomised per invocation. The same prompt will produce different anomaly scores, root causes, and policy results each run.
