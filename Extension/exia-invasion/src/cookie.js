// Cookie管理模块

/**
 * 应用Cookie字符串到浏览器
 * @param {string} cookieStr - Cookie字符串，格式为 "name=value; name2=value2"
 */
export const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  
  for (const kv of cookieStr.split(/;\s*/)) {
    const [name, value] = kv.split("=");
    if (!name) continue;
    
    await chrome.cookies.set({
      // 使用能匹配域名的URL
      url: "https://blablalink.com/",
      domain: ".blablalink.com",   // 对子域也生效
      name,
      value,
      path: "/",
      secure: true,                // HTTPS安全连接
      sameSite: "no_restriction",  // 跟随原站设置
    });
  }
};

/**
 * 清除指定站点的所有Cookie
 */
export const clearSiteCookies = async () => {
  const all = await chrome.cookies.getAll({});
  await Promise.all(
    all
      .filter(c => c.domain.endsWith("blablalink.com"))
      .map(c => {
        const url =
          (c.secure ? "https://" : "http://") +
          c.domain.replace(/^\./, "") +
          c.path;
        return chrome.cookies.remove({ url, name: c.name });
      })
  );
};