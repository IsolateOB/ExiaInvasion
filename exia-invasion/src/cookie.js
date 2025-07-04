// Cookie管理模块

/**
 * 应用Cookie字符串到浏览器
 * @param {string} cookieStr - Cookie字符串，格式为 "name=value; name2=value2"
 */
export const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  
  // 首先获取当前所有的blablalink.com相关的Cookie，建立域名映射
  const existingCookies = await chrome.cookies.getAll({});
  const domainMap = {};
  
  existingCookies.forEach(cookie => {
    if (cookie.domain.endsWith("blablalink.com")) {
      domainMap[cookie.name] = cookie.domain;
    }
  });
  
  for (const kv of cookieStr.split(/;\s*/)) {
    const [name, value] = kv.split("=");
    if (!name) continue;
    
    // 根据Cookie名称确定正确的域名
    let domain = ".blablalink.com"; // 默认域名
    let url = "https://blablalink.com/";
    
    // 特殊处理所有以__ss_storage_cookie_cache_开头的Cookie，它们的域名是.www.blablalink.com
    if (/^__ss_storage_cookie_cache_/.test(name)) {
      domain = ".www.blablalink.com";
      url = "https://www.blablalink.com/";
    } else if (domainMap[name]) {
      // 使用已存在Cookie的域名
      domain = domainMap[name];
      url = "https://" + domain.replace(/^\./, "") + "/";
    }
    
    await chrome.cookies.set({
      url,
      domain,
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

/**
 * 获取当前站点的所有Cookie并转换为字符串
 * @returns {Promise<string>} Cookie字符串
 */
export const getCurrentCookies = async () => {
  const all = await chrome.cookies.getAll({});
  const siteCookies = all.filter(c => c.domain.endsWith("blablalink.com"));
  return siteCookies.map(c => `${c.name}=${c.value}`).join("; ");
};