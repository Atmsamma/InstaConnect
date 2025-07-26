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


def cleanup_video_file(video_file_path):
    """Clean up only the downloaded video file to save storage space"""
    try:
        if os.path.exists(video_file_path):
            os.remove(video_file_path)
            log(f"🗑️ Cleaned up video file: {video_file_path}")
        else:
            log(f"⚠️ Video file not found for cleanup: {video_file_path}")
    except Exception as e:
        log(f"⚠️ Could not clean up video file {video_file_path}: {e}")


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


def detect_faces_in_image(image_path):
    """Detect faces in an image using OpenCV"""
    try:
        import cv2
        
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            log(f"❌ Could not load image: {image_path}")
            return 0
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Load the face detection classifier
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        num_faces = len(faces)
        log(f"👤 Found {num_faces} face(s) in {os.path.basename(image_path)}")
        return num_faces
        
    except ImportError:
        log("❌ OpenCV not available, skipping face detection")
        return 1  # Assume face is present if OpenCV is not available
    except Exception as e:
        log(f"❌ Error detecting faces in {image_path}: {e}")
        return 0


def extract_screenshots_intelligent(video_url, output_dir, num_screenshots=5):
    """Extract meaningful screenshots using scene detection and face detection"""
    video_file = None
    try:
        os.makedirs(output_dir, exist_ok=True)

        url_str = str(video_url) if hasattr(video_url, '__str__') else video_url
        log(f"🧠 Intelligently extracting {num_screenshots} screenshots from video: {url_str}")

        # Download video file first
        video_file = os.path.join(output_dir, "input_video.mp4")
        log("⬇️ Downloading video...")

        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url_str, timeout=60, headers=headers, stream=True)
            response.raise_for_status()

            with open(video_file, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            file_size = os.path.getsize(video_file)
            log(f"✅ Download complete ({file_size} bytes)")
            
            if file_size == 0:
                log("❌ Downloaded file is empty")
                return []
                
        except Exception as e:
            log(f"❌ Failed to download video: {e}")
            return []

        # Check if ffmpeg is available
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
            log("✅ FFmpeg is available")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            log(f"❌ FFmpeg not available: {e}")
            return []

        # Step 1: Extract scene changes using FFmpeg
        scene_dir = os.path.join(output_dir, "scenes")
        os.makedirs(scene_dir, exist_ok=True)
        
        scene_pattern = os.path.join(scene_dir, "scene_%03d.jpg")
        
        log("🎬 Detecting scene changes...")
        scene_cmd = [
            "ffmpeg", "-i", video_file,
            "-vf", "select='gt(scene,0.4)',showinfo",
            "-vsync", "vfr",
            "-q:v", "2",
            scene_pattern,
            "-y", "-hide_banner", "-loglevel", "info"
        ]
        
        log(f"🔧 Running scene detection: {' '.join(scene_cmd)}")
        scene_result = subprocess.run(scene_cmd, capture_output=True, text=True, timeout=120)
        
        if scene_result.returncode != 0:
            log(f"⚠️ Scene detection failed, falling back to time-based extraction")
            return extract_screenshots_fallback(video_file, output_dir, num_screenshots)
        
        # Find generated scene files
        scene_files = []
        for f in os.listdir(scene_dir):
            if f.startswith("scene_") and f.endswith(".jpg"):
                scene_path = os.path.join(scene_dir, f)
                if os.path.getsize(scene_path) > 0:
                    scene_files.append(scene_path)
        
        scene_files.sort()
        log(f"🎭 Found {len(scene_files)} scene change frames")
        
        if len(scene_files) == 0:
            log("⚠️ No scene changes detected, falling back to time-based extraction")
            return extract_screenshots_fallback(video_file, output_dir, num_screenshots)
        
        # Step 2: Face detection on scene frames
        face_frames = []
        log("👤 Checking frames for human faces...")
        
        for scene_file in scene_files:
            num_faces = detect_faces_in_image(scene_file)
            if num_faces > 0:
                face_frames.append({
                    'path': scene_file,
                    'faces': num_faces,
                    'basename': os.path.basename(scene_file)
                })
        
        log(f"😊 Found {len(face_frames)} frames with faces")
        
        # Step 3: Select the best frames
        final_screenshots = []
        
        if len(face_frames) >= num_screenshots:
            # We have enough face frames, select evenly distributed ones
            indices = []
            step = len(face_frames) / num_screenshots
            for i in range(num_screenshots):
                idx = int(i * step)
                indices.append(idx)
            
            for i, idx in enumerate(indices):
                old_path = face_frames[idx]['path']
                new_path = os.path.join(output_dir, f"screenshot_{i+1}.jpg")
                
                # Copy the selected frame to final location
                import shutil
                shutil.copy2(old_path, new_path)
                final_screenshots.append(new_path)
                
                log(f"🖼️ Selected screenshot_{i+1}.jpg with {face_frames[idx]['faces']} face(s)")
        
        elif len(face_frames) > 0:
            # Use all face frames and fill remaining with scene frames
            for i, frame in enumerate(face_frames):
                if i >= num_screenshots:
                    break
                old_path = frame['path']
                new_path = os.path.join(output_dir, f"screenshot_{i+1}.jpg")
                
                import shutil
                shutil.copy2(old_path, new_path)
                final_screenshots.append(new_path)
                
                log(f"🖼️ Selected screenshot_{i+1}.jpg with {frame['faces']} face(s)")
            
            # Fill remaining slots with non-face scene frames if needed
            remaining_slots = num_screenshots - len(face_frames)
            non_face_scenes = [f for f in scene_files if f not in [frame['path'] for frame in face_frames]]
            
            for i, scene_file in enumerate(non_face_scenes[:remaining_slots]):
                shot_num = len(face_frames) + i + 1
                new_path = os.path.join(output_dir, f"screenshot_{shot_num}.jpg")
                
                import shutil
                shutil.copy2(scene_file, new_path)
                final_screenshots.append(new_path)
                
                log(f"🖼️ Added screenshot_{shot_num}.jpg (scene change, no faces)")
        
        else:
            # No faces found, use first N scene frames
            log("⚠️ No faces detected, using scene change frames")
            for i, scene_file in enumerate(scene_files[:num_screenshots]):
                new_path = os.path.join(output_dir, f"screenshot_{i+1}.jpg")
                
                import shutil
                shutil.copy2(scene_file, new_path)
                final_screenshots.append(new_path)
                
                log(f"🖼️ Selected screenshot_{i+1}.jpg (scene change)")
        
        # Clean up scene directory
        import shutil
        shutil.rmtree(scene_dir, ignore_errors=True)
        
        log(f"✅ Successfully extracted {len(final_screenshots)} intelligent screenshots")
        return final_screenshots

    except Exception as e:
        log(f"❌ Error in intelligent extraction: {e}")
        import traceback
        log(f"📊 Traceback: {traceback.format_exc()}")
        
        # Fallback to time-based extraction
        if video_file and os.path.exists(video_file):
            return extract_screenshots_fallback(video_file, output_dir, num_screenshots)
        return []
    
    finally:
        # Always clean up the video file
        if video_file and os.path.exists(video_file):
            cleanup_video_file(video_file)


def extract_screenshots_fallback(video_file, output_dir, num_screenshots=5):
    """Fallback time-based screenshot extraction when scene detection fails"""
    try:
        log("🔄 Using fallback time-based extraction...")
        
        # Get video duration
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30
        )
        
        duration = None
        if result.returncode == 0 and result.stdout.strip():
            try:
                duration = float(result.stdout.strip())
            except ValueError:
                pass
        
        if duration is None or duration <= 0:
            # Use fixed timestamps
            timestamps = [1, 3, 5, 7, 9][:num_screenshots]
        else:
            # Calculate evenly spaced timestamps
            if duration < num_screenshots:
                timestamps = [i * 0.5 for i in range(1, num_screenshots + 1) if i * 0.5 < duration]
            else:
                interval = duration / (num_screenshots + 1)
                timestamps = [interval * (i + 1) for i in range(num_screenshots)]
        
        screenshots = []
        for i, ts in enumerate(timestamps, 1):
            output_path = os.path.join(output_dir, f"screenshot_{i}.jpg")
            
            cmd = [
                "ffmpeg", "-ss", str(ts), "-i", video_file,
                "-vframes", "1", "-q:v", "2", output_path,
                "-y", "-hide_banner", "-loglevel", "warning"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                if file_size > 0:
                    screenshots.append(output_path)
                    log(f"🖼️ Fallback screenshot_{i}.jpg at {ts:.1f}s")
        
        return screenshots
        
    except Exception as e:
        log(f"❌ Fallback extraction failed: {e}")
        return []


def extract_screenshots(video_url, output_dir, num_screenshots=5):
    """Main screenshot extraction function - tries intelligent method first, falls back if needed"""
    return extract_screenshots_intelligent(video_url, output_dir, num_screenshots)


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
                # Extract screenshots (no duration needed)
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
    try:
        # Find the session file
        session_files = list(pathlib.Path(".").glob("*_session.json"))
        if not session_files:
            log("❌ No session file found. Please log in first.")
            return

        session_file = session_files[0]
        log(f"📁 Using session file: {session_file}")

        bot = Client()
        bot.load_settings(str(session_file))
        log("✅ Instagram session loaded successfully")
    except Exception as e:
        log(f"❌ Failed to initialize bot: {e}")
        return

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
            threads = bot.direct_threads(amount=amount)
            log(f"📥 Fetched {len(threads)} threads successfully")
            return threads
        except Exception as e:
            log(f"⚠️ Could not fetch threads: {e}")
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
                            "frames": media_data.get("screenshots", [])
                        }

                        message_data["analysis_bundle"] = analysis_bundle
                        log(f"📦 Analysis bundle created with {len(analysis_bundle.get('frames', []))} screenshots")
                        
                        # Screenshots are kept for later use - only video files are cleaned up
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
            threads = safe_threads(10)
            log(f"🔍 Checking {len(threads)} threads for new messages...")
            
            for thread in threads:
                if thread.messages:
                    try:
                        handle_new_dm(thread)
                    except Exception as e:
                        log(f"❌ Error handling thread {thread.id}: {e}")
                        continue
            
            log("💤 Waiting 15 seconds before next check...")
            time.sleep(15)
        except KeyboardInterrupt:
            log("🛑 Bot stopped by user.")
            break
        except Exception as e:
            log(f"❌ Error in main loop: {e}")
            import traceback
            log(f"📊 Traceback: {traceback.format_exc()}")
            log("⏳ Waiting 30 seconds before retry...")
            time.sleep(30)


if __name__ == "__main__":
    main()