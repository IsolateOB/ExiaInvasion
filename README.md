# ExiaInvasion

**ExiaInvasion** is an open source crawler program that obtains Nikke character data in personal accounts from [blablalink](https://www.blablalink.com/) and generates progress tracker.

**ExiaInvasion** 是一个从 [blablalink](https://www.blablalink.com/) 获取个人账号中的Nikke人物数据并生成练度表的开源爬虫程序。





## 示例输出 Example output



![示例输出](/示例输出.png)





## 注意 Notice

- 需要 **Edge** 或 **Chrome** 浏览器。

	**Edge** or **Chrome** is required to run the program.
	
	
	


- 目前仅能输出简体中文和英文表格。

  Currently only tables in Simplified Chinese and English can be output.
  
  



## 用法 Usage

- 解压压缩包，浏览器进入 `chrome://extensions/` 或 `edge://extensions/` 页，启用 **开发者模式** ，点击 **加载已解压的扩展程序** ，选择解压后的文件夹。
  
  Unzip the package. In your browser, go to `chrome://extensions/` or `edge://extensions/`, enable **Developer mode**, click **Load unpacked extension**, and select the extracted folder.
  
  
  
- ### 主页面 Main Page

	- #### 爬虫 CRAWLER

		- 点击 **管理账号** 可进入 **管理页**。

			Click **Manage Accounts** to enter the **Management Page**.

			 

		- **合并保存为 ZIP** 将在 **运行** 完毕后，把所有文件合并为一个 zip 格式的压缩文件提供下载。

			**Merge and Save as ZIP** will merge all files into a ZIP archive for download after **Run** is completed

			

		- **运行时保存cookie** 将在 **运行** 时自动保存该账号的 **cookie** 以便下次运行时跳过登录步骤。 **管理账号** 页将看到保存的cookie。

			**Save Cookie During Runtime** will automatically save the account’s **cookie** while running, so the next run can skip the login step. You will see the saved cookie on the **Manage Accounts** page.

			

		- **导出 JSON** 将在 **运行** 完毕后输出表格的同时输出用于制表的账号原始数据。

			**Export JSON** will output the raw account data for tabulation alongside the table after **Run** is completed.

			

		- **运行时激活标签页** 将在 **运行** 时用 **账号密码** 登录时，切换到脚本操作的标签页。主要用于检查错误和手动操作人机验证。

			**Activate Tab During Runtime** will switch to the script-operated tab. This is mainly for checking errors and handling manual human verification when logging in with **account and password** during **Run**.

			

		- **保存当前账号 COOKIE** 可保存当前浏览器在 [blablalink](https://www.blablalink.com/) 的登录cookie。**管理账号** 页将看到保存的cookie。

		

	- #### 合并

		- **选择表格** 后，**开始合并** 会将这些表格纵向合并



- ### 管理页

	- 将 **账号密码** 或 **cookie** 填入并保存。
	- **启用** 开关打开时，**运行** 将获取该行账号的数据。





## 开发中功能

- 可修改的 **nikke** 爬取列表。





## Communication and feedback 交流与反馈

[Discord](https://discord.gg/rN7CrqmY)

[Github](https://github.com/IsolateOB/ExiaInvasion)

[东南亚服交流QQ群](https://qm.qq.com/q/hznFzFRAf8)

