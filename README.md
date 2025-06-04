# ExiaInvasion

**ExiaInvasion** is an open source **Browser Extension** that obtains Nikke character data in personal accounts from [blablalink](https://www.blablalink.com/) and generates progress tracker.

**ExiaInvasion** 是一个从 [blablalink](https://www.blablalink.com/) 获取个人账号中的Nikke人物数据并生成练度表的开源 **浏览器插件**。





## 示例输出 Example output



![示例输出](/示例输出.png)





## 注意 Notice

- 需要 **Edge** 或 **Chrome** 浏览器或其他 **Chromium** 内核浏览器。

	**Edge** or **Chrome** or another **Chromium**-based browser.
	
	
	


- 目前仅能输出简体中文和英文表格。

  Currently only tables in Simplified Chinese and English can be output.
  
  



## 用法 Usage

- 解压压缩包，浏览器进入 `chrome://extensions/` 或 `edge://extensions/` 页，启用 **开发者模式** ，点击 **加载已解压的扩展程序** ，选择解压后的文件夹。
  
  Unzip the package. In your browser, go to `chrome://extensions/` or `edge://extensions/`, enable **Developer mode**, click **Load unpacked extension**, and select the extracted folder.
  
  
  
- ### 主页面 Main Page

	- #### 爬虫 CRAWLER

		- 点击 **管理账号 & 妮姬** 可进入 **管理页**。

			Click **MANAGE ACCOUNTS & NIKKES** to enter the **Management Page**.

			 

		- **合并保存为 ZIP** 将在 **运行** 完毕后，把所有文件合并为一个 zip 格式的压缩文件提供下载。

			**Merge and Save as ZIP** will merge all files into a ZIP archive for download after **Run** is completed

			

		- **运行时保存cookie** 将在 **运行** 时自动保存该账号的 **cookie** 以便下次运行时跳过登录步骤。 **管理账号** 页将看到保存的cookie。

			**Save Cookie During Runtime** will automatically save the account’s **cookie** while running, so the next run can skip the login step. You will see the saved cookie on the **Management** page.

			

		- **导出 JSON** 将在 **运行** 完毕后输出表格的同时输出用于制表的账号原始数据。

			**Export JSON** will output the raw account data for tabulation alongside the table after **Run** is completed.

			

		- **运行时激活标签页** 将在 **运行** 时用 **账号密码** 登录时，切换到脚本操作的标签页。主要用于检查错误和手动操作人机验证。

			**Activate Tab During Runtime** will switch to the script-operated tab. This is mainly for checking errors and handling manual human verification when logging in with **account and password** during **Run**.

			

		- **保存当前账号 COOKIE** 可保存当前浏览器在 [blablalink](https://www.blablalink.com/) 的登录cookie。**管理账号** 页将看到保存的cookie。

			**SAVE CURRENT ACCOUNT COOKIE** will save the current browser’s login cookie for [blablalink](https://www.blablalink.com/). The saved cookie can be viewed on the **Management** page.

		

	- #### 合并 Merge

		- **选择表格** 后，**开始合并** 会将这些表格纵向合并

			After **SELECT EXCEL FILE**, clicking **START MERGING** will vertically merge these tables.



- ### 管理页 Management Page

	- #### 账号列表 Account List

	  - 填入并保存 **邮箱** 和 **密码**。

	  	Enter and save **Email** and **Password**.

	  	

	  - 当同时存在 **邮箱**， **密码**，和 **cookie** 的时候，将默认使用 **cookie**。

	  	When **email**, **password**, and **cookie** are all present, the **cookie** will be used by default.

	  	

	  - **启用** 开关打开时，**运行** 将获取该行账号的数据。
	
	  	When the **Enable** switch is turned on, **Run** will fetch data for that account row.
	
	  	
	
	- #### 妮姬管理 NIKKE MANAGEMENT
	
	  - **优先级** 为主观评级可自行决定，它将决定该妮姬在表中的背景色。
		
		  **Priority** is a subjective rating that you can decide for yourself, and it will determine the background color of that Nikke in the table.
	  
		  
	  
		- **选择词条** 时，不管是否选择词条都会获取并统计该词条，但未选择的词条将在制表时被隐藏，可自行展开查看。
		
		  When **Select Stats**, whether or not you select an attribute, it will still be collected and counted, but unselected attributes will be hidden during table generation and can be expanded for viewing.






## 交流与反馈 Communication and feedback

[Discord](https://discord.gg/rN7CrqmY)

[Github](https://github.com/IsolateOB/ExiaInvasion)

[东南亚服交流QQ群](https://qm.qq.com/q/hznFzFRAf8)

