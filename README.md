# ExiaInvasion

**ExiaInvasion** is an open source crawler program that obtains Nikke character data in personal accounts from [blablalink](https://www.blablalink.com/) and generates progress tracker

**ExiaInvasion** 是一个从 [blablalink](https://www.blablalink.com/) 获取个人账号中的Nikke人物数据并生成练度表的开源爬虫程序



## Example output 示例输出



![示例输出](示例输出.png)



## Notice 注意

- **Edge** or **Chrome** is required to run the program

	需要 **Edge** 或 **Chrome** 浏览器
	
- First run may not open the webpage properly and report errors continuously. Please close the program and browser and run again.

	第一次运行可能无法正常打开网页并连续报错，请关闭程序与浏览器并重新运行


- Currently only tables in Simplified Chinese and English can be output.

  目前仅能输出简体中文和英文表格



## Usage 用法

- Please fill in the account information in **LoginIndex** and save the file. Do not delete the first row (the header). You only need to fill in either `Password` or `Cookies`. Due to anti-bot mechanisms, some accounts may trigger human verification that cannot be bypassed — in such cases, you must use `Cookies`.

  请将所有账号信息填入 **LoginIndex** ，不要删去第一行表头。`Password`和`Cookies`选其一填写。由于反爬虫机制，部分账号会弹人机验证并且无法通过，此时只能使用`Cookies`。

- `Cookies` can be obtained via a browser extension such as **Cookie Editor**, available at:

  `Cookies`通过浏览器插件得到，例如**Cookie Editor**，下载地址：

  https://chromewebstore.google.com/detail/ookdjilphngeeeghgngjabigmpepanpl?utm_source=item-share-cb

- After installing the extension, log in to [blablalink](https://www.blablalink.com/) manually in your browser. Then open the extension, click Copy, choose Header String, and paste the copied content into **LoginIndex**.

  安装插件后，在浏览器中手动登录[blablalink](https://www.blablalink.com/)，打开插件选择 复制，选择 Header String，复制后填入 **LoginIndex**

- **merge** can merge all tables in the same directory.

  **merge** 将合并同目录中的所有表格。

- **SearchIndexEng** is used to provide the role search index of the main program **ExiaInvasion**. Roles can be added or deleted. The role name defaults to Simplified Chinese.

	**SearchIndexChs** 用于提供主程序 **ExiaInvasion** 的角色搜索索引，可添加或删除角色。

- `priority` is based on my personal subjective character priority, only for tabulation purposes, black>blue>yellow.

	`priority`是依据我个人主观的角色优先级，仅用于制表，黑>蓝>黄。

- Equipment Effects have 15 levels. Levels 1-5 are marked in red, levels 6-10 are marked in yellow, levels 11-14 are marked in blue, and level 15 are marked in black.

  装备词条有15级，1-5级为红色，6-10级标记为黄色，11-14级标记为蓝色，15级标记为黑色。



## [Nikke Table 妮姬表](https://www.kdocs.cn/l/cqaoCnPqbPpM)

![育成指南](育成指南.png)





## Communication and feedback 交流与反馈

[Discord](https://discord.gg/rN7CrqmY)

[Github](https://github.com/IsolateOB/ExiaInvasion)

[东南亚服交流QQ群](https://qm.qq.com/q/hznFzFRAf8)

