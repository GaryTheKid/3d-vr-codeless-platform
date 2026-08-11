from pathlib import Path
import re
p = Path(r"E:\创业\XR+AI\Demo\demo-talk-slides.html")
t = p.read_text(encoding="utf-8")
t2 = re.sub(
    r"(final-delivery/demo-slide-assets/[^\"?]+\.png)(?:\?v=[^\"]*)?",
    r"\1?v=cartoon2",
    t,
)
p.write_text(t2, encoding="utf-8")
print(t2.count("?v=cartoon2"))
