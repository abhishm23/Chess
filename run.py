import os
import subprocess
import sys
import threading
import time
import webbrowser

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)

    # Install dependencies if not already installed
    if not os.path.exists(os.path.join(root, "node_modules")):
        print("Installing dependencies (npm install)...")
        subprocess.run(["npm", "install"], shell=True, check=True)

    print("\n" + "=" * 55)
    print("  Launching Chess Intelligent Training Web Application")
    print("  Local URL: http://localhost:3000")
    print("=" * 55 + "\n")

    # Open the user's default browser after server starts
    def launch_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:3000")

    threading.Thread(target=launch_browser, daemon=True).start()

    # Run Vite development server
    try:
        subprocess.run(["npm", "run", "dev"], shell=True)
    except KeyboardInterrupt:
        print("\nStopping chess training server...")

if __name__ == "__main__":
    main()
