import re

path = r"D:\Personal_Projects\Vaidhya_PEC\services\edge-ai\mqtt_client.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Change:
#         if self.settings.mqtt_username and self.settings.mqtt_password:
#             self.client.username_pw_set(
#                 self.settings.mqtt_username, self.settings.mqtt_password
#             )
#             self.client.tls_set()
#
# To:
#         if self.settings.mqtt_username and self.settings.mqtt_password:
#             self.client.username_pw_set(
#                 self.settings.mqtt_username, self.settings.mqtt_password
#             )
#         if self.settings.mqtt_url and self.settings.mqtt_url.startswith(("wss://", "mqtts://", "ssl://")):
#             self.client.tls_set()

old_block = '''        if self.settings.mqtt_username and self.settings.mqtt_password:
            self.client.username_pw_set(
                self.settings.mqtt_username, self.settings.mqtt_password
            )
            self.client.tls_set()'''

new_block = '''        if self.settings.mqtt_username and self.settings.mqtt_password:
            self.client.username_pw_set(
                self.settings.mqtt_username, self.settings.mqtt_password
            )
        if self.settings.mqtt_url and self.settings.mqtt_url.startswith(("wss://", "mqtts://", "ssl://")):
            self.client.tls_set()'''

content = content.replace(old_block, new_block)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
