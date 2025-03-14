from selenium import webdriver
import json
import requests
import sys


class ExiaInvasion:
    def __init__(self):
        print("Launching Edge browser")
        print("正在启动Edge浏览器")
        print()
        print("请同意所有cookie并用账号密码完成登录, 不要用第三方登录方式")

        self.cookie_str = self.getCookies()
        self.getPlayerNikkes_response = self.getPlayerNikkes()

    def getCookies(self):
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

        driver = webdriver.Edge()
        driver.get("https://www.blablalink.com/login")

        print()
        input("After logging in, press Enter to continue...\n 登录后按回车键继续...")

        all_cookies = driver.get_cookies()

        filtered_cookies = {cookie["name"]: cookie["value"] for cookie in all_cookies if
                            cookie["name"] in important_keys}

        for key, value in filtered_cookies.items():
            if value is None:
                print("Failed to retrieve cookies. Please close this window and rerun the program.")
                print("Cookie获取失败，请关闭该窗口重新运行此程序")
                sys.exit(1)

        self.game_user_name = filtered_cookies["game_user_name"]

        cookie_str = "; ".join([f"{key}={value}" for key, value in filtered_cookies.items()])

        return cookie_str


    def getHeader(self, contentLength):
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7",
            "Content-Length": contentLength,
            "Content-Type": "application/json",
            "Cookie": self.cookie_str,
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
        return headers


    def getPlayerNikkes(self):
        headers = self.getHeader(self.cookie_str, "2")
        url = "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes"
        response = requests.post(url, headers=headers, json={})
        return response

    def writeJson(self, response):
        game_user_name = self.game_user_name
        filename = f"{game_user_name}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(response.json(), f, ensure_ascii=False, indent=4)

        print(f"Data has been saved to {filename}")
        print(f"数据已保存到 {filename}")
