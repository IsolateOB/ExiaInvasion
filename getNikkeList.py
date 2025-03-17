import json
import requests


headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7",
            "cache-control" : "no-cache",
            "Dnt": "1",
            "Origin": "https://www.blablalink.com",
            "Pragma": "no-cache",
            "priority": "u=1, i",
            "Referer": "https://www.blablalink.com/",
            "Sec-Ch-Ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Microsoft Edge";v="134"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0"
        }


twUrl = "https://sg-tools-cdn.blablalink.com/character/zh-TW/nikke_list_zh-TW.json"
enUrl = "https://sg-tools-cdn.blablalink.com/character/en/nikke_list_en.json"
krUrl = "https://sg-tools-cdn.blablalink.com/character/ko/nikke_list.json"
jaUrl = "https://sg-tools-cdn.blablalink.com/character/ja/nikke_list_ja.json"

url_dict = {"nikke_list_繁體中文.json": twUrl,
            "nikke_list_English.json": enUrl,
            "nikke_list_한국어.json": krUrl,
            "nikke_list_日本語.json": jaUrl
            }

# 保存为json文件
for filename, url in url_dict.items():
    response = requests.get(url, headers=headers).json()
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(response, f, ensure_ascii=False, indent=4)



