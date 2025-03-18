# ExiaInvasion

`ExiaInvasion` is an open source crawler program that obtains Nikke character data in personal accounts from `blablalink` and generates tables

`ExiaInvasion`是一个从`blablalink`获取个人账号中的Nikke人物数据并生成表格的开源爬虫程序



Can be used for personal progression assistance, union member recruitment, union member progression statistics

可用于个人育成辅助，联盟成员招募，联盟成员育成统计



## Example output 示例输出



![示例输出](示例输出.png)



## Notice 注意

- Make sure you have the `Edge` browser (installed by default on Windows systems)

	确保已安装`Edge`浏览器（Windows系统默认安装）
	
- Please fill in all account information into `LoginIndex`

  请将所有账号信息填入`LoginIndex`


- Currently only tables in Simplified Chinese can be output.

  目前仅能输出简体中文表格



## Usage 用法

- `SearchIndex` is used to provide the role search index of the main program `ExiaInvasion`. Roles can be added or deleted. The role name defaults to Simplified Chinese. The file can be changed as needed according to `nikke_list_English`  

	`SearchIndex`用于提供主程序`ExiaInvasion`的角色搜索索引，可添加或删除角色，角色名默认为简体中文。文件可对照`nikke_list_繁體中文`按需更改

- `"character_ids"` consists of all 11 numbers between `id` and `id+10`

	`"character_ids"`由`id`与`id+10`之间的所有11个数组成

- `"priority"` is based on my personal subjective character priority, only for tabulation purposes, black>blue>yellow

	`“priority”`是依据我个人主观的角色优先级，仅用于制表，黑>蓝>黄

- Equipment Effects have 15 levels. Levels 1-5 are marked in red, levels 6-10 are marked in yellow, levels 11-14 are marked in blue, and level 15 are marked in black.

	装备词条有15级，1-5级为红色，6-10级标记为黄色，11-14级标记为蓝色，15级标记为黑色

- `merge` can merge all tables in the same directory

	`merge`将合并同目录中的所有表格



## Communication and feedback 交流与反馈

联盟Discord: https://discord.gg/rN7CrqmY

Github: https://github.com/IsolateOB/ExiaInvasion

东南亚服交流QQ群: 774618246

