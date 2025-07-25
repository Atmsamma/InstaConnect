
import time
import json
import sys
import os
from instagrapi import Client
from instagrapi.exceptions import UnknownError
import pathlib

def log(*args):
    print(*args, file=sys.stderr, flush=True)

def load_json(filename):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_json(filename, data):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Triggers for the bot to respond to
TRIGGERS = ["whereclipped", "cliplive"]

def main():
    # Find the session file
    session_files = list(pathlib.Path(".").glob("*_session.json"))
    if not session_files:
        log("❌ No session file found. Please log in first.")
        return
    
    session_file = session_files[0]
    log(f"📁 Using session file: {session_file}")
    
    bot = Client()
    bot.load_settings(str(session_file))

    TRACKER_FILE = "output/replied_messages_tracker.json"
    TRIGGER_MESSAGES_FILE = "output/trigger_messages.json"

    # Safe load of our JSON tracker
    try:
        with open(TRACKER_FILE, "r", encoding="utf-8") as f:
            replied_tracker = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        replied_tracker = {}
        save_json(TRACKER_FILE, replied_tracker)

    # Load trigger messages data
    trigger_messages = load_json(TRIGGER_MESSAGES_FILE)

    log("🚀 Bot is running... (Ctrl+C to stop)")

    def safe_threads(amount=10):
        try:
            return bot.direct_threads(amount=amount)
        except Exception as e:
            log("⚠️ Could not fetch threads:", e)
            return []

    def safe_username(user_id):
        try:
            return bot.user_info(user_id).username
        except Exception:
            return f"user_{user_id}"

    def try_reply_with_backoff(thread_id, text, retries=3):
        """Try sending a DM reply, backing off on UnknownError."""
        for i in range(retries):
            try:
                bot.direct_answer(thread_id, text)
                return True
            except UnknownError as e:
                log(f"⚠️ UnknownError, retry {i+1}/{retries}: {e}")
                time.sleep(2 ** i)
        return False

    def handle_new_dm(thread):
        thread_id = thread.id
        last_seen = replied_tracker.get(thread_id, {}).get("last_replied_msg_id")

        for msg in thread.messages:
            if msg.id == last_seen:
                break  # we've already processed up to here

            text = (msg.text or "").lower()
            if any(t in text for t in TRIGGERS) or msg.media_share:
                username = safe_username(msg.user_id)
                log(f"💬 Trigger in {thread_id} from @{username}")

                # Store detailed message data
                message_data = {
                    "message_id": msg.id,
                    "thread_id": thread_id,
                    "user_id": msg.user_id,
                    "username": username,
                    "text": msg.text or "",
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                    "has_media_share": bool(msg.media_share),
                    "media_share_url": msg.media_share.code if msg.media_share else None,
                    "triggered_words": [t for t in TRIGGERS if t in text.lower()],
                    "reply_sent": False,
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                }

                # Our reply text
                reply_text = f"👋 Thanks @{username}, I'll look into that!"

                success = try_reply_with_backoff(thread_id, reply_text)
                if not success:
                    log("❌ All retries failed. Marking as seen and skipping.")
                    try:
                        bot.direct_send_seen(msg.id)
                    except Exception as e:
                        log("⚠️ Couldn't mark as seen:", e)
                else:
                    message_data["reply_sent"] = True

                # Store the trigger message data
                if msg.id not in trigger_messages:
                    trigger_messages[msg.id] = message_data
                    save_json(TRIGGER_MESSAGES_FILE, trigger_messages)
                    log(f"📝 Stored trigger message data for {msg.id}")

                # Always update tracker so we don't loop on this msg again
                replied_tracker[thread_id] = {"last_replied_msg_id": msg.id}
                save_json(TRACKER_FILE, replied_tracker)
                break  # only one reply per scan

            else:
                log(f"➡️ No trigger in msg {msg.id}")

    # Main loop
    while True:
        try:
            for thread in safe_threads(10):
                if thread.messages:
                    handle_new_dm(thread)
            time.sleep(15)
        except KeyboardInterrupt:
            log("🛑 Bot stopped by user.")
            break
        except Exception as e:
            log("❌ Error in main loop:", e)
            time.sleep(30)

if __name__ == "__main__":
    main()
