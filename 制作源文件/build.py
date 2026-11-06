"""One local entry point. No uploads, publication, installs, or deletion."""
from pathlib import Path
import argparse,subprocess,sys

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description='Build the static site; optionally verify and package local delivery ZIPs.')
parser.add_argument('--verify',action='store_true',help='Run static acceptance checks after building (no browser required).')
parser.add_argument('--package',action='store_true',help='Create and verify both local ZIPs after static checks.')
args=parser.parse_args()
def run(name):subprocess.run([sys.executable,'-X','utf8',str(Path(__file__).with_name(name))],cwd=ROOT,check=True)
if not (ROOT/'site/dist/index.html').is_file():parser.error('Expected site/dist/index.html. See README.md for the complete-package layout.')
run('build-travel-guide.py')
if args.verify or args.package:run('verify-adopted-static.py')
if args.package:
    run('package-static-host.py')
    run('package-final.py')
