# Data dictionary (spreadsheet columns)

| Column | Type | Meaning |
|--------|------|---------|
| pid | string | P01… |
| date | date | Session date |
| material_id | string | M01…M05 |
| consent | 0/1 | |
| record_consent | 0/1 | |
| session_status | enum | Complete / Partial / Invalid |
| age | number | |
| gender | string | |
| role | string | |
| field | string | |
| eng_ui | 1–7 | |
| vr_exp | string | |
| ai_exp | string | |
| teach_exp | string | |
| pretest_total | 0–8 | |
| posttest_total | 0–8 | |
| gain | number | post−pre |
| tlx_mental | 0–100 | |
| tlx_physical | 0–100 | |
| tlx_temporal | 0–100 | |
| tlx_performance | 0–100 | raw NASA (low=good) |
| tlx_performance_rev | 0–100 | 100−performance |
| tlx_effort | 0–100 | |
| tlx_frustration | 0–100 | |
| tlx_raw | number | mean of 6 using performance_rev |
| s1…s3 | 1–7 | overall satisfaction |
| a1…a4 | 1–7 | authoring |
| l1…l4 | 1–7 | learning |
| u1,u2 | 1–7 | UMUX-Lite optional |
| gen_start, gen_end | datetime | |
| gen_sec | number | |
| learn_start, learn_end | datetime | |
| learn_sec | number | |
| learn_complete | 0/1 | finished all sections |
| gen_notes | text | errors, retries |
| interview_file | string | recording filename |
| coder_notes | text | |
