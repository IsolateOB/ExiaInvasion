// src/cookie.js

export const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  
  for (const kv of cookieStr.split(/;\s*/)) {
    const [name, value] = kv.split("=");
    if (!name) continue;
    
    await chrome.cookies.set({
      // 必须用能匹配 domain 的 URL，这里写裸域即可
      url: "https://blablalink.com/",
      domain: ".blablalink.com",   // 关键：对子域也生效
      name,
      value,
      path: "/",
      secure: true,                // 接口全是 HTTPS，安全起见
      sameSite: "no_restriction",  // 跟随原站设置
    });
  }
};

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