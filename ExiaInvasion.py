from selenium import webdriver
import json
import requests
import sys


class ExiaInvasion:
    def __init__(self):
        self.cookie_str = self.getCookies()
        self.role_name = self.getRoleName()
        self.table = json.loads(open("SearchIndex.json", "r", encoding="utf-8").read())
        self.playerNikkes = ExiaInvasion.getPlayerNikkes(self)
        ExiaInvasion.addEquipmentsToTable(self)
        ExiaInvasion.addNikkesDetailsToTable(self)
        self.table["synchroLevel"] = self.synchroLevel
        self.table["name"] = self.role_name
        ExiaInvasion.saveTableToJson(self)


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


    def getRoleName(self):
        headers = self.getHeader("2")
        url = "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo"
        response = requests.post(url, headers=headers, json={}).json()

        role_name = response["data"]["role_name"]

        return role_name


    def getPlayerNikkes(self):
        headers = self.getHeader("2")
        url = "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes"
        response = requests.post(url, headers=headers, json={}).json()

        return response

    def addNikkesDetailsToTable(self):
        print("Fetching Nikke details...")
        print("正在获取Nikke详情...")
        self.synchroLevel = 1
        for element, characters in self.table["elements"].items():
            for character_name, details in characters.items():
                for nikke_details in self.playerNikkes["data"]["player_nikkes"]:
                    if details["name_code"] == nikke_details["name_code"]:
                        details["skill1_level"] = nikke_details["skill1_level"]
                        details["skill2_level"] = nikke_details["skill2_level"]
                        details["skill_burst_level"] = nikke_details["skill_burst_level"]
                        details["item_rare"] = nikke_details["item_rare"]
                        details["item_level"] = nikke_details["item_level"]
                    if nikke_details["level"] > self.synchroLevel:
                        self.synchroLevel = nikke_details["level"]


    def getEquipments(self, character_ids):
        headers = self.getHeader("96")
        url = "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerEquipContents"
        json_data = requests.post(url, headers=headers, json={"character_ids": character_ids}).json()
        player_equip_contents = json_data["data"]["player_equip_contents"]

        final_slots = [None, None, None, None]

        for record in reversed(player_equip_contents):
            equip_contents = record["equip_contents"]
            for i in range(4):
                if final_slots[i] is None:
                    slot_data = equip_contents[i]
                    if slot_data["equip_id"] != -99 or slot_data["equip_effects"]:
                        final_slots[i] = slot_data

        result = {}
        for slot_index, slot_data in enumerate(final_slots):
            if slot_data is None:
                result[slot_index] = []
                continue

            details_list = []
            for effect in slot_data["equip_effects"]:
                for func in effect["function_details"]:
                    details_list.append({
                        "function_type": func["function_type"],
                        "function_value": abs(func["function_value"]) / 100.0,
                        "level": func["level"]
                    })

            result[slot_index] = details_list

        return result

    def addEquipmentsToTable(self):
        print("Fetching equipment data...")
        print("正在获取装备数据...")
        for element, characters in self.table["elements"].items():
            for character_name, details in characters.items():
                details["equipments"] = self.getEquipments(details["character_ids"])


    def saveTableToJson(self):
        filename = f"{self.role_name}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(self.table, f, ensure_ascii=False, indent=4)

        print(f"Data saved to {filename}")
        print("数据已保存到", f"{self.role_name}.json")


if __name__ == "__main__":
    print("Launching Edge browser")
    print("正在启动Edge浏览器")
    print()
    print("Please agree to all cookies and log in with your account and password. Do not use third-party login methods.")
    print("请同意所有cookie并用账号密码完成登录, 不要用第三方登录方式")
    exia = ExiaInvasion()