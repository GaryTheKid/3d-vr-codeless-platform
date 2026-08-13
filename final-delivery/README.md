# Final delivery

**CS6180 submission package →** [`submission-for-CS6180-final/`](./submission-for-CS6180-final/)

Start there: [`submission-for-CS6180-final/README.md`](./submission-for-CS6180-final/README.md)

## Supplementary — coverage-contract audit

Short script (in the submission folder): [`submission-for-CS6180-final/audit_coverage_contracts.py`](./submission-for-CS6180-final/audit_coverage_contracts.py)

It checks that sample courses actually declare what they cover/install: `covers[]` ids exist in the KG, `installsAha[]` ids exist in aha keys, every aha is installed by ≥1 section, and each course has a reading + quiz. Run from the submission folder:

```bash
python audit_coverage_contracts.py
```

See the Supplementary section in [`submission-for-CS6180-final/README.md`](./submission-for-CS6180-final/README.md) for the bind-time caveat (silent repair vs raw planner JSON).
