
import time
import json
import sys
import os
import subprocess
import tempfile
import requests
from datetime import datetime
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


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def save_json(filename, data):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=json_serial)


def get_video_duration(video_url):
    """Get video duration using ffprobe"""
    try:
        # Convert HttpUrl object to string if needed
        url_str = str(video_url) if hasattr(video_url, '__str__') else video_url
        log(f"🔍 Trying to get duration for: {url_str[:100]}...")
        
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", url_str
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            duration = float(result.stdout.strip())
            log(f"✅ Video duration: {duration} seconds")
            return duration
        else:
            log(f"❌ ffprobe error (code {result.returncode}): {result.stderr.strip()}")
            return None
    except subprocess.TimeoutExpired:
        log("❌ ffprobe timeout - video URL may be inaccessible")
        return None
    except Exception as e:
        log(f"❌ Error getting video duration: {e}")
        return None


def extract_screenshots(video_url, output_dir, num_screenshots=5):
    """Extract screenshots from video using ffmpeg"""
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert HttpUrl object to string if needed
        url_str = str(video_url) if hasattr(video_url, '__str__') else video_url
        
        # Get video duration
        duration = get_video_duration(url_str)
        if not duration:
            log("⚠️ Skipping screenshot extraction - no duration available")
            return []
        
        log(f"📹 Extracting {num_screenshots} screenshots from {duration}s video")
        screenshots = []
        # Divide duration into segments and take screenshots at equal intervals
        interval = duration / (num_screenshots + 1)
        
        for i in range(1, num_screenshots + 1):
            timestamp = interval * i
            output_path = os.path.join(output_dir, f"clip_{i}.jpg")
            
            cmd = [
                "ffmpeg", "-y", "-ss", str(timestamp), "-i", url_str,
                "-vframes", "1", "-q:v", "2", output_path, "-hide_banner", "-loglevel", "error"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0 and os.path.exists(output_path):
                screenshots.append(output_path)
                log(f"📸 Screenshot {i} saved: {output_path}")
            else:
                log(f"❌ ffmpeg error for screenshot {i} (code {result.returncode}): {result.stderr.strip()}")
        
        log(f"✅ Successfully extracted {len(screenshots)} screenshots")
        return screenshots
    except subprocess.TimeoutExpired:
        log("❌ ffmpeg timeout during screenshot extraction")
        return []
    except Exception as e:
        log(f"❌ Error extracting screenshots: {e}")
        return []


def find_previous_media_message(messages, trigger_msg_index):
    """Find the media message immediately before the trigger message"""
    # Look backwards from the trigger message
    for i in range(trigger_msg_index + 1, len(messages)):
        msg = messages[i]
        
        # Check for various media types
        if (msg.media_share or msg.clip or 
            (hasattr(msg, 'item_type') and msg.item_type in ['media_share', 'clip', 'xma_media_share'])):
            return msg
    
    return None


def extract_media_data(media_msg, bot):
    """Extract comprehensive media data from a message"""
    try:
        media_data = {
            "message_id": media_msg.id,
            "item_type": getattr(media_msg, 'item_type', None),
            "timestamp": getattr(media_msg, 'timestamp', None),
            "user_id": media_msg.user_id,
            "video_url": None,
            "caption": None,
            "media_type": None,
            "duration": None,
            "screenshots": []
        }
        
        # Get username
        try:
            user_info = bot.user_info(media_msg.user_id)
            media_data["username"] = user_info.username
        except:
            media_data["username"] = f"user_{media_msg.user_id}"
        
        # Extract media info based on type
        media_obj = None
        if media_msg.media_share:
            media_obj = media_msg.media_share
        elif media_msg.clip:
            media_obj = media_msg.clip
        
        if media_obj:
            # Extract video URL and convert to string
            video_url = None
            if hasattr(media_obj, 'video_url') and media_obj.video_url:
                video_url = str(media_obj.video_url)
            elif hasattr(media_obj, 'video_versions') and media_obj.video_versions:
                video_url = str(media_obj.video_versions[0].url)
            
            media_data["video_url"] = video_url
            
            # Extract other metadata
            media_data["caption"] = getattr(media_obj, 'caption', {}).get('text', '') if hasattr(media_obj, 'caption') else ''
            media_data["media_type"] = getattr(media_obj, 'media_type', None)
            
            # If we have a video URL, process it
            if video_url:
                # Get duration
                duration = get_video_duration(video_url)
                media_data["duration"] = duration
                
                # Extract screenshots
                output_dir = os.path.join("output", "screenshots", media_msg.id)
                screenshots = extract_screenshots(video_url, output_dir)
                media_data["screenshots"] = screenshots
        
        return media_data
        
    except Exception as e:
        log(f"❌ Error extracting media data: {e}")
        return None


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
                time.sleep(2**i)
        return False

    def handle_new_dm(thread):
        thread_id = thread.id
        last_seen = replied_tracker.get(thread_id, {}).get("last_replied_msg_id")

        for i, msg in enumerate(thread.messages):
            if msg.id == last_seen:
                break  # we've already processed up to here

            text = (msg.text or "").lower()
            
            # Check if this is a trigger message
            triggered_words = [t for t in TRIGGERS if t in text]
            
            if triggered_words:
                username = safe_username(msg.user_id)
                log(f"💬 Trigger '{triggered_words[0]}' in {thread_id} from @{username}")

                # Find the previous media message
                media_msg = find_previous_media_message(thread.messages, i)
                
                message_data = {
                    "trigger_message": {
                        "id": msg.id,
                        "text": msg.text,
                        "user_id": msg.user_id,
                        "username": username,
                        "timestamp": getattr(msg, 'timestamp', None),
                        "triggered_words": triggered_words
                    },
                    "media_message": None,
                    "analysis_ready": False
                }
                
                if media_msg:
                    log(f"🎥 Found previous media message: {media_msg.id}")
                    media_data = extract_media_data(media_msg, bot)
                    if media_data:
                        message_data["media_message"] = media_data
                        message_data["analysis_ready"] = True
                        
                        # Create analysis bundle
                        analysis_bundle = {
                            "trigger": triggered_words[0],
                            "video_url": media_data.get("video_url"),
                            "username": media_data.get("username"),
                            "media_type": media_data.get("item_type"),
                            "timestamp": media_data.get("timestamp"),
                            "caption": media_data.get("caption"),
                            "duration": media_data.get("duration"),
                            "frames": media_data.get("screenshots", [])
                        }
                        
                        message_data["analysis_bundle"] = analysis_bundle
                        log(f"📦 Analysis bundle created with {len(analysis_bundle.get('frames', []))} screenshots")
                else:
                    log("⚠️ No previous media message found")

                # Reply to the user
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
