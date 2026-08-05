#!/usr/bin/env python3
"""Install XR EduAgent Python deps: GPU torch first, CPU fallback, then requirements.txt."""
from __future__ import annotations

import os
import re
import subprocess
import sys

# Prefer newer CUDA builds first; driver must support the toolkit version.
# nvidia-smi "CUDA Version" is the max supported toolkit, not what's installed.
CUDA_INDEXES = (
    ('cu132', 'https://download.pytorch.org/whl/cu132'),
    ('cu130', 'https://download.pytorch.org/whl/cu130'),
    ('cu126', 'https://download.pytorch.org/whl/cu126'),
)
CPU_INDEX = 'https://download.pytorch.org/whl/cpu'
ROOT = os.path.dirname(os.path.abspath(__file__))
REQ = os.path.join(ROOT, 'requirements.txt')


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    print('>', ' '.join(cmd), flush=True)
    return subprocess.run(cmd, check=False)


def pip(*args: str) -> int:
    return run([sys.executable, '-m', 'pip', *args]).returncode


def has_nvidia() -> bool:
    try:
        r = subprocess.run(
            ['nvidia-smi'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=20,
        )
        return r.returncode == 0 and 'NVIDIA' in (r.stdout or '')
    except Exception:
        return False


def driver_cuda_major_minor() -> tuple[int, int] | None:
    try:
        r = subprocess.run(
            ['nvidia-smi'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=20,
        )
        m = re.search(r'CUDA Version:\s*(\d+)\.(\d+)', r.stdout or '')
        if m:
            return int(m.group(1)), int(m.group(2))
    except Exception:
        pass
    return None


def torch_cuda_ok() -> bool:
    code = (
        'import torch; '
        'ok=bool(torch.cuda.is_available()); '
        'print(torch.__version__, torch.version.cuda, ok); '
        'raise SystemExit(0 if ok else 1)'
    )
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    out = (r.stdout or '').strip() or (r.stderr or '').strip()
    print('torch check:', out, flush=True)
    return r.returncode == 0


def install_torch(index_url: str, label: str) -> bool:
    print(f'\n=== Installing torch/torchvision ({label}) ===', flush=True)
    rc = pip(
        'install', '--upgrade',
        'torch', 'torchvision',
        '--index-url', index_url,
    )
    if rc != 0:
        print(f'{label}: pip failed (exit {rc})', flush=True)
        return False
    if label.startswith('cu'):
        return torch_cuda_ok()
    # CPU path: just confirm import
    r = subprocess.run(
        [sys.executable, '-c', 'import torch; print(torch.__version__)'],
        capture_output=True, text=True,
    )
    print('torch check:', (r.stdout or '').strip(), flush=True)
    return r.returncode == 0


def select_cuda_indexes() -> list[tuple[str, str]]:
    ver = driver_cuda_major_minor()
    if not ver:
        return list(CUDA_INDEXES)
    major, minor = ver
    # Map driver max toolkit → candidate wheel tags (highest first).
    # Skip tags that need a newer toolkit than the driver advertises.
    tag_need = {'cu132': (13, 2), 'cu130': (13, 0), 'cu126': (12, 6)}
    out = []
    for tag, url in CUDA_INDEXES:
        need = tag_need[tag]
        if (major, minor) >= need:
            out.append((tag, url))
    return out or list(CUDA_INDEXES)


def install_requirements() -> int:
    print('\n=== Installing requirements.txt (keep existing torch if possible) ===', flush=True)
    return pip(
        'install', '-r', REQ,
        '--upgrade-strategy', 'only-if-needed',
    )


def main() -> int:
    print(f'Python: {sys.version.split()[0]}', flush=True)
    print(f'Requirements: {REQ}', flush=True)

    gpu_ok = False
    if has_nvidia():
        print('NVIDIA GPU detected via nvidia-smi.', flush=True)
        for tag, url in select_cuda_indexes():
            if install_torch(url, tag):
                gpu_ok = True
                print(f'Using GPU build: {tag}', flush=True)
                break
            print(f'{tag} not usable, trying next…', flush=True)
        if not gpu_ok:
            print('No CUDA torch build worked; falling back to CPU.', flush=True)
    else:
        print('No NVIDIA GPU detected; using CPU torch.', flush=True)

    if not gpu_ok:
        if not install_torch(CPU_INDEX, 'cpu'):
            print('CPU torch install failed.', flush=True)
            return 1

    rc = install_requirements()
    if rc != 0:
        return rc

    # docling may have pulled a CPU wheel on Windows — restore GPU if we had it.
    if has_nvidia() and not torch_cuda_ok():
        print('\nCUDA torch lost after requirements install; restoring GPU build…', flush=True)
        for tag, url in select_cuda_indexes():
            if install_torch(url, tag):
                gpu_ok = True
                break
        if not gpu_ok:
            print('Warning: could not restore CUDA torch; Docling will use CPU.', flush=True)

    print('\nDone.', flush=True)
    torch_cuda_ok()  # print final status
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
