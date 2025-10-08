import subprocess
import os

os.environ['BINOMO_AUTHTOKEN'] = '2ba71577-82f7-4751-8902-4de7f0c94831'
os.environ['BINOMO_DEVICE_ID'] = '636d5616769d02c84c488e3353f28789'
os.environ['BINOMO_DEVICE_TYPE'] = 'web'
os.environ['BINOMO_SERVICE_PORT'] = '5001'

subprocess.run(['python', 'binomo_service.py'])
