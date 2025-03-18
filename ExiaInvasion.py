from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import requests
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pandas as pd



class ExiaInvasion:
    def __init__(self, server, account, password):
        self.cookie_str = self.getCookies(server, account, password)
        self.role_name = self.getRoleName()
        self.table = json.loads(open("SearchIndex.json", "r", encoding="utf-8").read())
        self.playerNikkes = ExiaInvasion.getPlayerNikkes(self)
        ExiaInvasion.addEquipmentsToTable(self)
        ExiaInvasion.addNikkesDetailsToTable(self)
        self.table["synchroLevel"] = self.synchroLevel
        self.table["name"] = self.role_name
        ExiaInvasion.saveTableToExcel(self)


    @staticmethod
    def getCookies(server, account, password):
        print("Please do not operate the browser unless a human verification or error occurs")
        print("请不要对浏览器进行任何操作，除非出现人机验证或报错")
        print()


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

        # 接受cookie政策
        acceptCookie = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
        driver.execute_script("arguments[0].click();", acceptCookie)


        # 选择服务器
        if server == "0":
            serverSelect = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR,
                                            "body > div.w-full.outline-none.max-h-\[65vh\].max-w-\[var\(--max-pc-w\)\].right-0.mx-auto.overflow-x-hidden.overflow-y-auto.flex.flex-col.bg-\[var\(--op-fill-white\)\].rounded-t-\[8px\].fixed.left-0.bottom-0.z-50 > div.flex-1.overflow-y-auto.w-full.mr-\[4px\].mb-\[35px\] > ul > li:nth-child(1)")))
        else:
            serverSelect = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR,
                                            "body > div.w-full.outline-none.max-h-\[65vh\].max-w-\[var\(--max-pc-w\)\].right-0.mx-auto.overflow-x-hidden.overflow-y-auto.flex.flex-col.bg-\[var\(--op-fill-white\)\].rounded-t-\[8px\].fixed.left-0.bottom-0.z-50 > div.flex-1.overflow-y-auto.w-full.mr-\[4px\].mb-\[35px\] > ul > li:nth-child(2)")))

        driver.execute_script("arguments[0].click();", serverSelect)


        changeToPassword = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, '//*[@id="login"]/div[2]/button')))
        driver.execute_script("arguments[0].click();", changeToPassword)

        account_input = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.ID, "loginPwdForm_account")))
        account_input.send_keys(account)

        password_input = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.ID, "loginPwdForm_password")))
        password_input.send_keys(password)

        loginbutton = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable(
                (By.XPATH, '//*[@id="loginPwdForm"]/div[3]/div/div/div/div/button')))

        driver.execute_script("arguments[0].click();", loginbutton)

        print("Retrieving cookies...")
        print("正在获取cookie...")
        print()

        while True:
            all_cookies = driver.get_cookies()
            filtered_cookies = {cookie["name"]: cookie["value"] for cookie in all_cookies if
                                cookie["name"] in important_keys}

            if all(key in filtered_cookies for key in important_keys):
                cookie_str = "; ".join([f"{key}={value}" for key, value in filtered_cookies.items()])
                driver.quit()
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
        print()
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
        if json_data == None:
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
        print()
        for element, characters in self.table["elements"].items():
            for character_name, details in characters.items():
                details["equipments"] = self.getEquipments(details["character_ids"])


    @staticmethod
    def set_outer_border(ws, start_row, start_col, end_row, end_col, side=Side(border_style="medium", color="000000")):
        for col in range(start_col, end_col + 1):
            top_cell = ws.cell(row=start_row, column=col)
            tborder = top_cell.border
            top_cell.border = Border(
                left=tborder.left,
                right=tborder.right,
                top=side,
                bottom=tborder.bottom
            )

            bottom_cell = ws.cell(row=end_row, column=col)
            bborder = bottom_cell.border
            bottom_cell.border = Border(
                left=bborder.left,
                right=bborder.right,
                top=bborder.top,
                bottom=side
            )

        for row in range(start_row, end_row + 1):
            left_cell = ws.cell(row=row, column=start_col)
            lborder = left_cell.border
            left_cell.border = Border(
                left=side,
                right=lborder.right,
                top=lborder.top,
                bottom=lborder.bottom
            )

            right_cell = ws.cell(row=row, column=end_col)
            rborder = right_cell.border
            right_cell.border = Border(
                left=rborder.left,
                right=side,
                top=rborder.top,
                bottom=rborder.bottom
            )


    @staticmethod
    def set_vertical_border(ws, start_row, end_row, col, border_side=Side(border_style="medium", color="000000"), side_pos="right"):
        for r in range(start_row, end_row + 1):
            cell = ws.cell(row=r, column=col)
            old_border = cell.border
            if side_pos == "right":
                cell.border = Border(
                    left=old_border.left,
                    right=border_side,
                    top=old_border.top,
                    bottom=old_border.bottom
                )
            else:
                cell.border = Border(
                    left=border_side,
                    right=old_border.right,
                    top=old_border.top,
                    bottom=old_border.bottom
                )


    @staticmethod
    def set_horizontal_border(ws, row, start_col, end_col, border_side=Side(border_style="medium", color="000000"), side_pos="bottom"):
        for c in range(start_col, end_col + 1):
            cell = ws.cell(row=row, column=c)
            old_border = cell.border
            if side_pos == "bottom":
                cell.border = Border(
                    left=old_border.left,
                    right=old_border.right,
                    top=old_border.top,
                    bottom=border_side
                )
            else:
                cell.border = Border(
                    left=old_border.left,
                    right=old_border.right,
                    top=border_side,
                    bottom=old_border.bottom
                )


    @staticmethod
    def item_rare_to_str(v):
        if v == 1:
            return "R"
        elif v == 2:
            return "SR"
        elif v == 3:
            return "SSR"
        else:
            return ""


    @staticmethod
    def get_fill_by_level(level):
        if 1 <= level <= 5:
            return PatternFill("solid", fgColor="FF7777")  # 红
        elif 6 <= level <= 10:
            return PatternFill("solid", fgColor="FFFF77")  # 黄
        elif 11 <= level <= 14:
            return PatternFill("solid", fgColor="77AAFF")  # 蓝
        elif level == 15:
            return PatternFill("solid", fgColor="FF000000")  # 黑
        else:
            return None


    @staticmethod
    def get_font_by_level(level):
        if level == 15:
            return Font(color="FFFFFF")
        else:
            return Font(color="000000")


    def saveTableToExcel(self):
        print("Saving data to table...")
        print("正在保存数据到表格...")
        print()

        medium_side = Side(border_style="medium", color="000000")
        thin_side = Side(border_style="thin", color="000000")
        alliance_name = self.table.get("name", "")
        synchro_level = self.table.get("synchroLevel", 0)
        elements_data = self.table["elements"]  # dict

        property_keys = [
            "skill1_level",  # 0
            "skill2_level",  # 1
            "skill_burst_level",  # 2
            "item_rare",  # 3
            "item_level",  # 4
            None,  # 5
            "IncElementDmg",    # 6
            "StatAtk",  # 7
            "StatAmmoLoad", # 8
            "StatChargeTime",   #9
            "StatChargeDamage",  # 10
            "StatDef",  # 11
            "StatCritical",  # 12
            "StatCriticalDamage",  # 13
            "StatAccuracyCircle"  # 14
        ]
        property_labels = [
            "技能1",
            "技能2",
            "爆裂",
            "珍藏品",  # 会合并到下一列
            None,  # 跳过
            "T10",
            "优越",
            "攻击",
            "弹夹",
            "蓄速",
            "蓄伤",
            "防御",
            "暴击",
            "暴伤",
            "命中",
        ]

        wb = Workbook()
        ws = wb.active
        ws.title = "成员信息"

        ws.row_dimensions[1].height = 25
        ws.row_dimensions[2].height = 25
        ws.row_dimensions[3].height = 25

        cell_alliance = ws.cell(row=1, column=1, value="角色名称")
        cell_synchro = ws.cell(row=1, column=2, value="同步等级")
        cell_alliance.alignment = Alignment(horizontal="center", vertical="center")
        cell_synchro.alignment = Alignment(horizontal="center", vertical="center")
        ws.merge_cells(start_row=1, start_column=1, end_row=3, end_column=1)
        ws.merge_cells(start_row=1, start_column=2, end_row=3, end_column=2)

        start_col = 3
        width_per_char = 15

        for element_name, chars_dict in elements_data.items():
            num_chars = len(chars_dict)
            total_width = num_chars * width_per_char

            ws.merge_cells(start_row=1, start_column=start_col, end_row=1, end_column=start_col + total_width - 1)
            c_elem = ws.cell(row=1, column=start_col, value=element_name)
            c_elem.alignment = Alignment(horizontal="center", vertical="center")
            c_elem.font = Font(bold=True)
            self.set_outer_border(ws, 1, start_col, 1, start_col + total_width - 1, medium_side)

            col_cursor = start_col
            for char_name, char_info in chars_dict.items():
                ws.merge_cells(start_row=2, start_column=col_cursor, end_row=2,
                               end_column=col_cursor + width_per_char - 1)
                c_char = ws.cell(row=2, column=col_cursor, value=char_name)
                c_char.alignment = Alignment(horizontal="center", vertical="center")
                self.set_horizontal_border(ws, 2, col_cursor, col_cursor + width_per_char - 1,
                                           border_side=Side(border_style="thin", color="000000"), side_pos="bottom")

                priority = char_info.get("priority", "")
                if priority == "black":
                    c_char.fill = PatternFill("solid", fgColor="FF000000")
                    c_char.font = Font(color="FFFFFF", bold=True)
                elif priority == "blue":
                    c_char.fill = PatternFill("solid", fgColor="99CCFF")
                    c_char.font = Font(bold=True)
                elif priority == "yellow":
                    c_char.fill = PatternFill("solid", fgColor="FFFF88")
                    c_char.font = Font(bold=True)



                for i, label in enumerate(property_labels):
                    # 跳过 None
                    if label is None:
                        continue
                    col_index = col_cursor + i
                    if i == 3:
                        # 合并 i=3,4
                        ws.merge_cells(start_row=3, start_column=col_index, end_row=3, end_column=col_index + 1)
                        cell_head = ws.cell(row=3, column=col_index, value=label)
                        cell_head.alignment = Alignment(horizontal="center", vertical="center")
                    else:
                        cell_head = ws.cell(row=3, column=col_index, value=label)
                        cell_head.alignment = Alignment(horizontal="center", vertical="center")

                self.set_outer_border(ws, 2, col_cursor, 3, col_cursor + width_per_char - 1, medium_side)

                skill1 = char_info.get("skill1_level", 0)
                skill2 = char_info.get("skill2_level", 0)
                skill_burst = char_info.get("skill_burst_level", 0)
                item_rare = self.item_rare_to_str(char_info.get("item_rare", 0))
                item_level = char_info.get("item_level", 0)

                for i in range(5):
                    ws.merge_cells(
                        start_row=4, start_column=col_cursor + i,
                        end_row=8, end_column=col_cursor + i
                    )
                ws.cell(row=4, column=col_cursor + 0, value=skill1 if skill1 > 0 else "").alignment = Alignment(horizontal="center", vertical="center")

                ws.cell(row=4, column=col_cursor + 1, value=skill2 if skill2 > 0 else "").alignment = Alignment(horizontal="center", vertical="center")

                ws.cell(row=4, column=col_cursor + 2, value=skill_burst if skill_burst > 0 else "").alignment = Alignment(horizontal="center", vertical="center")

                ws.cell(row=4, column=col_cursor + 3, value=item_rare).alignment = Alignment(horizontal="center", vertical="center")

                ws.cell(row=4, column=col_cursor + 4, value=item_level if item_level >= 0 else "").alignment = Alignment(horizontal="center", vertical="center")


                ws.cell(row=4, column=col_cursor + 5, value="头").alignment = Alignment(horizontal="center",
                                                                                        vertical="center")
                ws.cell(row=5, column=col_cursor + 5, value="身").alignment = Alignment(horizontal="center",
                                                                                        vertical="center")
                ws.cell(row=6, column=col_cursor + 5, value="手").alignment = Alignment(horizontal="center",
                                                                                        vertical="center")
                ws.cell(row=7, column=col_cursor + 5, value="足").alignment = Alignment(horizontal="center",
                                                                                        vertical="center")
                ws.cell(row=8, column=col_cursor + 5, value="合计").alignment = Alignment(horizontal="center",
                                                                                          vertical="center")

                equipments = char_info.get("equipments", {})
                sum_stats = {
                    "IncElementDmg": 0.0,
                    "StatAtk": 0.0,
                    "StatAmmoLoad": 0.0,
                    "StatChargeTime": 0.0,
                    "StatChargeDamage": 0.0,
                    "StatDef": 0.0,
                    "StatCritical": 0.0,
                    "StatCriticalDamage": 0.0,
                    "StatAccuracyCircle": 0.0,
                }
                for eq_idx in range(4):
                    row_idx = 4 + eq_idx
                    eq_list = equipments.get(eq_idx, [])
                    for i in range(6, 15):
                        c = ws.cell(row=row_idx, column=col_cursor + i)
                        c.value = ""
                        c.alignment = Alignment(horizontal="center", vertical="center")

                    for f in eq_list:
                        ftype = f.get("function_type", "")
                        fval = f.get("function_value", 0.0)
                        lvl = f.get("level", 0)
                        if ftype in sum_stats:
                            sum_stats[ftype] += fval
                        if ftype in property_keys[6:]:
                            i_prop = property_keys.index(ftype)  # 5..13
                            cell_eq = ws.cell(row=row_idx, column=col_cursor + i_prop)
                            cell_eq.value = fval/100
                            cell_eq.number_format = "0.00%"
                            # 上色
                            fill = self.get_fill_by_level(lvl)
                            font = self.get_font_by_level(lvl)
                            if fill: cell_eq.fill = fill
                            if font: cell_eq.font = font
                            cell_eq.alignment = Alignment(horizontal="center", vertical="center")

                for i in range(6, 15):
                    pkey = property_keys[i]
                    c_sum = ws.cell(row=8, column=col_cursor + i)
                    if pkey in sum_stats:
                        val_sum = sum_stats[pkey]
                        c_sum.value = val_sum/100
                        c_sum.number_format = "0.00%"
                    c_sum.alignment = Alignment(horizontal="center", vertical="center")

                self.set_outer_border(ws, 4, col_cursor, 8, col_cursor + width_per_char - 1, medium_side)

                self.set_vertical_border(ws, 3, 8, col_cursor + 3, border_side=thin_side, side_pos="left")
                self.set_vertical_border(ws, 3, 8, col_cursor + 4, border_side=thin_side, side_pos="right")
                self.set_vertical_border(ws, 3, 8, col_cursor + 5, border_side=thin_side, side_pos="right")

                self.set_vertical_border(ws, 1, 8, 1, border_side=medium_side, side_pos="left")
                self.set_vertical_border(ws, 1, 8, 1, border_side=medium_side, side_pos="right")

                self.set_horizontal_border(ws, 3, 1, 2, side_pos="bottom")
                self.set_horizontal_border(ws, 8, 1, 2, side_pos="bottom")

                self.set_horizontal_border(ws, 8, col_cursor + 5, col_cursor + 14,
                                           border_side=Side(border_style="thin", color="000000"), side_pos="top")

                ws.merge_cells(start_row=4, start_column=1, end_row=8, end_column=1)  # 联盟成员
                ws.merge_cells(start_row=4, start_column=2, end_row=8, end_column=2)  # 同步等级
                # 并在 row=4 写入
                ws.cell(row=4, column=1, value=alliance_name).alignment = Alignment(horizontal="center",
                                                                                    vertical="center")
                ws.cell(row=4, column=2, value=synchro_level).alignment = Alignment(horizontal="center",
                                                                                    vertical="center")

                col_cursor += width_per_char  # 下一个角色

            start_col += total_width

        ws.column_dimensions[get_column_letter(1)].width = 16
        ws.column_dimensions[get_column_letter(2)].width = 10

        for col in range(3, ws.max_column + 1):
            offset = (col - 3) % width_per_char
            if offset < 5:
                ws.column_dimensions[get_column_letter(col)].width = 6
            elif offset == 5:
                ws.column_dimensions[get_column_letter(col)].width = 5
            else:
                ws.column_dimensions[get_column_letter(col)].width = 10

        new_font_name = "微软雅黑"
        for row in ws.iter_rows():
            for cell in row:
                if cell.font:
                    old_font = cell.font
                    cell.font = Font(name=new_font_name,
                                     size=old_font.size,
                                     bold=old_font.bold,
                                     italic=old_font.italic,
                                     vertAlign=old_font.vertAlign,
                                     underline=old_font.underline,
                                     strike=old_font.strike,
                                     color=old_font.color)


        filename = f"{self.role_name}.xlsx"
        wb.save(filename)

        print(f"Data saved to {filename}")
        print("数据已保存到", f"{self.role_name}.xlsx")
        print()
        print()



if __name__ == "__main__":
    print("ExiaInvasion v1.24  by 灵乌未默")
    print()
    print("GitHub:")
    print("github.com/IsolateOB/ExiaInvasion")
    print()

    print("0: HK香港/MC澳门/TW台湾")
    print("1: JP日本/KR韩国/NA北美/SEA东南亚/Global全球")
    print()

    print("Please enter the server number:")
    print("请输入服务器编号：")
    print()

    server = int(input())

    loginIndex = pd.read_csv("LoginIndex.csv", encoding="utf-8-sig")

    loginIndex = loginIndex.dropna(how='all')

    errorList = []
    for index, row in loginIndex.iterrows():
        name = row["Name"]
        account = row["E-mail"]
        password = row["Password"]
        print(f"Logging in with account ({index + 1}/{len(loginIndex)}): {name}")
        print(f"正在登录账号 ({index + 1}/{len(loginIndex)}): {name}")
        print()
        try:
            ExiaInvasion(server, account, password)
        except Exception as e:
            print(f"Error occurred while processing account {index + 1}: {name}")
            print(f"处理账号 {index + 1} 时发生错误: {name}")
            errorList.append((index + 1, name))
            print(e)
            print()


    error_count = len(errorList)

    print(f"All accounts processed. Total errors: {error_count}")
    print(f"所有账号处理完成。总错误数: {error_count}")

    if error_count > 0:
        print("Error accounts:")
        print("错误账号：")
        for error in errorList:
            print(f"Account {error[0]}: {error[1]}")
            print(f"账号 {error[0]}: {error[1]}")

        with open("ErrorList.txt", "w", encoding="utf-8") as f:
            for error in errorList:
                f.write(f"Account {error[0]}: {error[1]}\n")
                f.write(f"账号 {error[0]}: {error[1]}\n")

        print("Error account list generated: ErrorList.txt")
        print("已生成错误账号清单：ErrorList.txt")
