from selenium import webdriver
import json
import requests
import sys


driver = webdriver.Edge()
driver.get("https://www.blablalink.com/login")

print()
input("请同意所有cookie并手动完成登录，登录后按回车键继续...")

all_cookies = driver.get_cookies()

important_keys = ["OptanonAlertBoxClosed",
                  "game_login_game",
                  "game_openid",
                  "game_channelid",
                  "game_token",
                  "game_gameid",
                  "game_user_name",
                  "game_uid",
                  "game_adult_status",
                  "OptanonConsent"]


filtered_cookies = {cookie["name"]: cookie["value"] for cookie in all_cookies if cookie["name"] in important_keys}
game_user_name = filtered_cookies["game_user_name"]

for key, value in filtered_cookies.items():
    if value is None:
        print("cookie获取失败，请关闭该窗口重新运行此程序")
        sys.exit(1)

cookie_str = "; ".join([f"{key}={value}" for key, value in filtered_cookies.items()])

playerNikkeUrl = "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes"

headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7",
    "Content-Length": "2",
    "Content-Type" : "application/json",
    "Cookie": cookie_str,
    "Dnt": "1",
    "Origin": "https://www.blablalink.com",
    "priority": "u=1, i",
    "Referer": "https://www.blablalink.com/",
    "Sec-Ch-Ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Microsoft Edge";v="134"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "sec-Fetch-Site": "same-site",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    "x-channel-type": "2",
    "x-common-params": '{"game_id":"16","area_id":"global","source":"pc_web","intl_game_id":"29080","language":"zh-TW","env":"prod","data_statistics_scene":"outer","data_statistics_page_id":"https://www.blablalink.com/","data_statistics_client_type":"pc_web","data_statistics_lang":"zh-TW"}',
    "x-language": "zh-TW"
}

response = requests.post(playerNikkeUrl, headers=headers, json={})
print("请求成功，正在保存数据...")


filename = f"{game_user_name}.json"
with open(filename, "w", encoding="utf-8") as f:
    json.dump(response.json(), f, ensure_ascii=False, indent=4)


print(f"数据已保存到 {filename}")
print("若未自动关闭，可关闭此窗口与浏览器")
sys.exit(0)


