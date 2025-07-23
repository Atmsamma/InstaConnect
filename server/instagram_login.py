#!/usr/bin/env python3
import sys
import json
import pathlib
import os

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "message": "Username and password required"}))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    # Check for additional arguments
    reuse_session = None
    two_factor_code = None
    challenge_method = None
    challenge_code = None
    
    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == "reuse":
            reuse_session = True
            i += 1
        elif sys.argv[i] == "fresh":
            reuse_session = False
            i += 1
        elif sys.argv[i] == "2fa" and i + 1 < len(sys.argv):
            two_factor_code = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "challenge" and i + 2 < len(sys.argv):
            challenge_method = sys.argv[i + 1]
            challenge_code = sys.argv[i + 2]
            i += 3
        else:
            i += 1
    
    try:
        # Import instagrapi here so the script fails gracefully if not installed
        from instagrapi import Client
        from instagrapi.exceptions import TwoFactorRequired, ChallengeRequired
        
        # Session file setup
        SESSION_FILE = pathlib.Path(f"{username}_session.json")
        
        # Create client
        bot = Client()
        bot.challenge_code_handler = lambda u, m: input(f"📨 Code via {m.upper()}: ")
        
        # Handle session reuse
        if SESSION_FILE.exists():
            if reuse_session is None:
                # Session exists but no preference given
                print(json.dumps({
                    "success": False,
                    "sessionExists": True,
                    "sessionFile": SESSION_FILE.name
                }))
                sys.exit(0)
            elif reuse_session:
                print("🔁 Reusing saved session...")
                bot.load_settings(str(SESSION_FILE))
            else:
                print("🗂 Deleting old session for fresh login...")
                SESSION_FILE.unlink()
        
        # Login if needed
        if not bot.user_id:
            print("🔐 Logging in…")
            try:
                bot.login(username, password)
            except TwoFactorRequired:
                if two_factor_code:
                    bot.two_factor_login(two_factor_code)
                else:
                    print(json.dumps({
                        "success": False,
                        "requiresTwoFactor": True,
                        "message": "Two-factor authentication required"
                    }))
                    sys.exit(0)
            except ChallengeRequired:
                if challenge_method and challenge_code:
                    print("⚠️ Processing challenge...")
                    ch = bot.get_challenge()
                    choices = ch.get("step_data", {}).get("choice", [])
                    
                    # Select challenge method
                    if challenge_method.lower() == "sms":
                        idx = 0
                    else:
                        idx = 1 if len(choices) > 1 else 0
                    
                    bot.challenge_send_code(idx)
                    bot.challenge_code(challenge_code)
                    print("🔁 Logging in again after challenge…")
                    bot.login(username, password)
                else:
                    print("⚠️ Challenge required — requesting methods…")
                    ch = bot.get_challenge()
                    choices = ch.get("step_data", {}).get("choice", [])
                    
                    challenge_methods = []
                    for choice in choices:
                        if "sms" in choice.lower():
                            challenge_methods.append({"type": "sms", "destination": "+1 •••• •••• 1234"})
                        elif "email" in choice.lower():
                            challenge_methods.append({"type": "email", "destination": "u***@example.com"})
                    
                    print(json.dumps({
                        "success": False,
                        "requiresChallenge": True,
                        "challengeMethods": challenge_methods,
                        "message": "Security challenge required"
                    }))
                    sys.exit(0)
        
        # Save session and return success
        bot.dump_settings(str(SESSION_FILE))
        print(json.dumps({
            "success": True,
            "message": f"✅ Logged in and session saved to {SESSION_FILE.name}"
        }))
        
    except ImportError:
        print(json.dumps({
            "success": False,
            "message": "instagrapi package not installed. Please run: pip install instagrapi"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": f"Login failed: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
