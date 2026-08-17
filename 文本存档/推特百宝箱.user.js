// ==UserScript==
// @name         推特百宝箱 - X 评论盾牌
// @namespace    https://github.com/liuGuanYi-hub/x-comment-shield
// @version      1.6.1
// @description  X(Twitter) 评论管理工具：自动扫描并隐藏广告、抽奖等无用评论，支持关键词/用户/正则黑名单、历史记录管理，可一键隐藏右侧栏。数据仅保存在本地。
// @author       liuGuanYi-hub
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/liuGuanYi-hub/x-comment-shield/main/%E6%96%87%E6%9C%AC%E5%AD%98%E6%A1%A3/%E6%8E%A8%E7%89%B9%E7%99%BE%E5%AE%9D%E7%AE%B1.user.js
// @downloadURL  https://raw.githubusercontent.com/liuGuanYi-hub/x-comment-shield/main/%E6%96%87%E6%9C%AC%E5%AD%98%E6%A1%A3/%E6%8E%A8%E7%89%B9%E7%99%BE%E5%AE%9D%E7%AE%B1.user.js
// ==/UserScript==

(function () {
    'use strict';


/**
 * ==========================
 * Config Module
 * ==========================
 */

const DEFAULT_CONFIG = {

    // 是否排除原作者
    excludeOriginalPoster: true,


    // 自动拉黑
    autoBlock: false,


    // 隐藏右侧栏（可选，默认不隐藏）
    hideSidebar: false,


    // 折叠左侧栏（可选，默认不折叠）
    collapseLeftSidebar: false,


    // 扫描次数
    scanTimes: 5,


    // 关键词黑名单
    blockKeywords: [

        "广告",
        "抽奖",
        "telegram",
        "博彩",
        "follow me"

    ],


    // 用户黑名单
    blockedUsers: [],


    // 自定义规则
    customRules: [],


    // 已处理记录
    history: []

};



const Config = {


    data: {},



    init(){

        const saved = GM_getValue(
            "twitter_x_config",
            {}
        );


        this.data = Object.assign(
            {},
            DEFAULT_CONFIG,
            saved
        );

    },



    get(key){

        return this.data[key];

    },



    set(key,value){

        this.data[key]=value;

        this.save();

    },



    save(){

        GM_setValue(
            "twitter_x_config",
            this.data
        );

    },


    reset(){

        this.data = structuredClone(
            DEFAULT_CONFIG
        );

        this.save();

    }


};



Config.init();



/**
 * ==========================
 * 工具函数
 * ==========================
 */


function sleep(ms){

    return new Promise(
        resolve=>setTimeout(resolve,ms)
    );

}



function log(...args){

    console.log(
        "[TwitterXToolkit]",
        ...args
    );

}

/**
 * ==========================
 * Comment Scanner Module
 * ==========================
 */


const CommentScanner = {


    /**
     * 获取当前页面所有推文节点
     */
    getTweets(){


        return Array.from(
            document.querySelectorAll(
                'article[data-testid="tweet"]'
            )
        );


    },



    /**
     * 获取单条推文信息
     */
    parseTweet(article){


        try{


            const textNode =
                article.querySelector(
                    '[data-testid="tweetText"]'
                );


            const text =
                textNode
                ?
                textNode.innerText
                :
                "";



            const userNode =
                article.querySelector(
                    'a[href^="/"][role="link"]'
                );



            let username = "";



            if(userNode){

                const href =
                    userNode.getAttribute(
                        "href"
                    );


                if(
                    href &&
                    href.startsWith("/")
                ){

                    username =
                        href.split("/")[1];

                }

            }



            const displayName =
                this.getDisplayName(
                    article
                );



            return {

                element:article,

                username,

                displayName,

                text,

                url:
                location.href


            };



        }
        catch(e){


            console.error(
                "parse tweet error",
                e
            );


            return null;

        }


    },





    /**
     * 获取显示名称
     */
    getDisplayName(article){


        const nameNode =
            article.querySelector(
                '[data-testid="User-Name"]'
            );


        if(!nameNode){

            return "";

        }


        return nameNode.innerText
            .split("\n")[0]
            .trim();


    },





    /**
     * 判断是不是当前推文作者
     */
    isOriginalPoster(tweet){


        const tweets =
            this.getTweets();



        if(
            tweets.length===0
        ){

            return false;

        }



        const first =
            this.parseTweet(
                tweets[0]
            );



        if(!first){

            return false;

        }



        return (
            tweet.username ===
            first.username
        );


    },





    /**
     * 扫描全部评论
     */
    scan(){


        const result=[];



        const tweets =
            this.getTweets();



        for(
            const article of tweets
        ){


            const tweet =
                this.parseTweet(
                    article
                );



            if(!tweet){

                continue;

            }



            // 排除原作者
            if(
                Config.get(
                    "excludeOriginalPoster"
                )
                &&
                this.isOriginalPoster(tweet)
            ){

                continue;

            }



            result.push(
                tweet
            );


        }



        log(
            "扫描完成:",
            result.length
        );



        return result;


    },





    /**
     * 无限滚动加载评论
     */
    async scanWithScroll(){

        // 不再自动滚动页面，
        // 避免干扰用户阅读。
        // 用户手动滚动时，
        // MutationObserver 会触发清理新加载评论。

        return this.scan();

    }


};

/**
 * ==========================
 * Matcher Module
 * 规则匹配系统
 * ==========================
 */


const Matcher = {


    /**
     * 检查文本是否包含关键词
     */
    matchKeyword(text){


        if(!text){

            return null;

        }



        const keywords =
            Config.get(
                "blockKeywords"
            );



        const lower =
            text.toLowerCase();



        for(
            const keyword of keywords
        ){


            if(
                lower.includes(
                    keyword.toLowerCase()
                )
            ){

                return {

                    type:"keyword",

                    value:keyword

                };

            }


        }


        return null;


    },





    /**
     * 正则规则匹配
     */
    matchRegex(text){


        if(!text){

            return null;

        }



        const rules =
            Config.get(
                "customRules"
            );



        for(
            const rule of rules
        ){



            try{


                const reg =
                    new RegExp(
                        rule,
                        "i"
                    );



                if(
                    reg.test(text)
                ){


                    return {

                        type:"regex",

                        value:rule

                    };


                }



            }
            catch(e){


                console.warn(
                    "invalid regex",
                    rule
                );


            }


        }



        return null;


    },







    /**
     * 用户黑名单匹配
     */
    matchUser(username){



        if(!username){

            return null;

        }



        const users =
            Config.get(
                "blockedUsers"
            );



        if(
            users.includes(
                username
            )
        ){


            return {


                type:"user",


                value:username


            };


        }



        return null;


    },







    /**
     * 检查历史处理记录
     */
    matchHistory(username){



        const history =
            Config.get(
                "history"
            );



        return history.some(
            item =>
                item.username === username
        );

    },








    /**
     * 综合判断
     */
    check(tweet){



        // 用户黑名单

        const user =
            this.matchUser(
                tweet.username
            );


        if(user){

            return user;

        }





        // 关键词

        const keyword =
            this.matchKeyword(
                tweet.text
            );



        if(keyword){

            return keyword;

        }





        // 正则

        const regex =
            this.matchRegex(
                tweet.text
            );



        if(regex){

            return regex;

        }



        return null;


    },







    /**
     * 批量过滤
     */
    filter(tweets){



        const result=[];



        for(
            const tweet of tweets
        ){


            const match =
                this.check(
                    tweet
                );



            if(match){


                result.push({

                    tweet,

                    reason:match

                });


            }


        }



        return result;


    }



};

/**
 * ==========================
 * Blocker Module
 * 评论屏蔽执行
 * ==========================
 */


const Blocker = {



    /**
     * 已处理缓存
     */
    processed:new Set(),






    /**
     * 获取唯一ID
     */
    getId(tweet){


        return (

            tweet.username
            +
            "_"
            +
            tweet.text.slice(0,50)

        );


    },







    /**
     * 隐藏评论 DOM
     */
    hide(tweet){


        if(
            !tweet.element
        ){

            return false;

        }



        try{


            tweet.element.style.display =
                "none";



            tweet.element.dataset
                .twitterToolkitHidden =
                "true";



            return true;


        }
        catch(e){


            console.error(
                "hide error",
                e
            );


            return false;

        }


    },








    /**
     * 添加隐藏提示
     */
    replace(tweet,reason){



        if(
            !tweet.element
        ){

            return;

        }




        const div =
            document.createElement(
                "div"
            );



        div.innerHTML = `

            <div
            style="
            padding:12px;
            margin:8px;
            border-radius:8px;
            background:#222;
            color:#aaa;
            font-size:14px;
            "
            >

            🚫 已隐藏评论

            <br>

            用户:
            @${tweet.username}

            <br>

            原因:
            ${reason.type}

            (${reason.value})

            </div>

        `;



        tweet.element.replaceWith(
            div
        );


    },









    /**
     * 自动拉黑用户
     *
     * 默认关闭
     */
    async blockUser(username){



        if(
            !Config.get(
                "autoBlock"
            )
        ){

            return false;

        }




        /*
            注意：

            这里不直接调用 Twitter API

            避免账号风险

            后续可以增加：
            手动确认按钮

        */


        log(
            "需要拉黑:",
            username
        );



        return false;


    },








    /**
     * 保存处理记录
     */
    saveHistory(tweet,reason){



        const history =
            Config.get(
                "history"
            );



        history.push({

            username:
            tweet.username,


            text:
            tweet.text.slice(
                0,
               100
            ),


            reason,


            time:
            Date.now()


        });



        // 限制数量

        if(
            history.length>500
        ){

            history.shift();

        }



        Config.set(
            "history",
            history
        );


    },







    /**
     * 执行单条屏蔽
     */
    execute(item){



        const tweet =
            item.tweet;



        const id =
            this.getId(
                tweet
            );



        if(
            this.processed.has(
                id
            )
        ){

            return;

        }



        this.processed.add(
            id
        );





        // 隐藏

        this.replace(

            tweet,

            item.reason

        );





        // 保存

        this.saveHistory(

            tweet,

            item.reason

        );





        // 可选

        this.blockUser(
            tweet.username
        );



    },







    /**
     * 批量执行
     */
    executeAll(items){



        for(
            const item of items
        ){


            this.execute(
                item
            );


        }



        log(
            "处理完成:",
            items.length
        );


    }





};

/**
 * ==========================
 * UI Module
 * 控制面板
 * ==========================
 */


const UI = {



    /**
     * 初始化
     */
    init(){


        this.injectStyle();


        this.registerMenu();


        this.createFloatingButton();


        // 应用侧栏隐藏

        this.applySidebar();



        // 应用左侧栏折叠

        this.applyLeftSidebar();


    },






    /**
     * CSS
     */
    injectStyle(){


        GM_addStyle(`

        .txtool-panel{


            position:fixed;

            right:20px;

            top:80px;

            width:320px;

            background:#ffffff;

            color:#14171a;

            border-radius:12px;

            padding:16px;

            z-index:999999;

            font-size:14px;

            border:1px solid rgba(0,0,0,0.08);

            box-shadow:
            0 4px 20px rgba(0,0,0,0.15);


        }



        .txtool-panel h3{

            margin-top:0;

        }




        .txtool-btn{


            width:100%;

            margin-top:8px;

            padding:8px;

            border:none;

            border-radius:8px;

            cursor:pointer;

            background:#1d9bf0;

            color:#fff;

            font-weight:500;

            transition:background .15s;


        }



        .txtool-btn:hover{

            background:#1a8cd8;

        }




        .txtool-input{


            width:100%;

            box-sizing:border-box;

            margin-top:6px;

            padding:8px;

            border:1px solid #cfd9de;

            border-radius:6px;

            background:#f7f9f9;

            color:#14171a;

            font-size:13px;

            resize:vertical;


        }




        .txtool-header{

            display:flex;

            align-items:center;

            justify-content:space-between;

            gap:8px;

            cursor:grab;

            user-select:none;

            touch-action:none;

        }




        .txtool-header h3{

            margin:0;

            flex:1;

        }




        .txtool-minimize{

            background:transparent;

            border:none;

            color:#536471;

            font-size:22px;

            font-weight:500;

            cursor:pointer;

            padding:0 8px;

            line-height:1;

            border-radius:4px;

            transition:background .15s;


        }




        .txtool-minimize:hover{

            color:#0f1419;

            background:rgba(0,0,0,0.06);

        }

`);


    },









    /**
     * 注册油猴菜单
     */
    registerMenu(){



        GM_registerMenuCommand(

            "打开 Twitter Toolkit",

            ()=>{

                this.openPanel();

            }

        );




        GM_registerMenuCommand(

            "立即扫描评论",

            ()=>{


                this.scan();


            }

        );




        GM_registerMenuCommand(

            "清空历史记录",

            ()=>{


                Config.set(
                    "history",
                    []
                );


                alert(
                    "历史已清空"
                );


            }

        );



    },











    /**
     * 创建悬浮按钮
     */
    createFloatingButton(){



        const btn =
            document.createElement(
                "button"
            );



        btn.innerText =
            "🛡️";



        btn.style.cssText = `

        position:fixed;

        right:20px;

        bottom:80px;

        width:45px;

        height:45px;

        border-radius:50%;

        border:none;

        background:#1d9bf0;

        color:white;

        font-size:20px;

        z-index:999999;

        cursor:grab;

        user-select:none;

        touch-action:none;

        transition:transform .2s ease;

        `;




        // ===== 拖拽逻辑 =====

        let isDragging = false;

        let hasMoved = false;

        let startX = 0;

        let startY = 0;

        let startLeft = 0;

        let startTop = 0;




        btn.addEventListener(
            "pointerdown",
            (e)=>{

                isDragging = true;

                hasMoved = false;

                startX = e.clientX;

                startY = e.clientY;

                startLeft = btn.offsetLeft;

                startTop = btn.offsetTop;

                btn.setPointerCapture(
                    e.pointerId
                );

                btn.style.cursor = "grabbing";

            }
        );




        btn.addEventListener(
            "pointermove",
            (e)=>{

                if(
                    !isDragging
                ){

                    return;

                }




                const dx =
                    e.clientX - startX;

                const dy =
                    e.clientY - startY;




                // 判断是否真的拖动了

                if(
                    Math.abs(dx) > 3
                    ||
                    Math.abs(dy) > 3
                ){

                    hasMoved = true;

                }




                let newLeft =
                    startLeft + dx;

                let newTop =
                    startTop + dy;




                // 限制不拖出屏幕

                const maxLeft =
                    window.innerWidth
                    - btn.offsetWidth;

                const maxTop =
                    window.innerHeight
                    - btn.offsetHeight;




                newLeft =
                    Math.max(
                        0,
                        Math.min(
                            newLeft,
                            maxLeft
                        )
                    );

                newTop =
                    Math.max(
                        0,
                        Math.min(
                            newTop,
                            maxTop
                        )
                    );




                btn.style.left =
                    newLeft + "px";

                btn.style.top =
                    newTop + "px";

                btn.style.right =
                    "auto";

                btn.style.bottom =
                    "auto";

            }
        );




        const endDrag =
            (e)=>{

                if(
                    !isDragging
                ){

                    return;

                }

                isDragging = false;

                btn.style.cursor = "grab";

                btn.releasePointerCapture(
                    e.pointerId
                );

            };




        btn.addEventListener(
            "pointerup",
            endDrag
        );




        btn.addEventListener(
            "pointercancel",
            endDrag
        );




        // 点击打开面板，
        // 拖动过则不触发

        btn.addEventListener(
            "click",
            (e)=>{

                if(
                    hasMoved
                ){

                    e.stopPropagation();

                    return;

                }

                this.openPanel();

            }
        );




        // 保存按钮引用，供面板开关时缩放

        this._floatBtn = btn;



        document.body.appendChild(
            btn
        );


    },









    /**
     * 应用侧栏隐藏
     *
     * 根据配置隐藏右侧栏
     * 并持续监听防止重新出现
     */
    applySidebar(){


        if(
            !Config.get(
                "hideSidebar"
            )
        ){

            return;

        }




        // 隐藏右侧栏

        const sidebar =
            document.querySelector(
                '[data-testid="sidebarColumn"]'
            );


        if(sidebar){

            sidebar.style.display =
                "none";

        }




        // 隐藏趋势栏（可选）

        const trends =
            document.querySelector(
                '[data-testid="trend"]'
            );


        if(trends){

            trends.style.display =
                "none";

        }




        // 主内容区占满宽度

        const primary =
            document.querySelector(
                '[data-testid="primaryColumn"]'
            );


        if(primary){


            // 强制覆盖 X 内联样式，让主内容居中

            primary.style.setProperty(
                "width",
                "990px",
                "important"
            );


            primary.style.setProperty(
                "flex-basis",
                "990px",
                "important"
            );


            primary.style.setProperty(
                "flex-grow",
                "0",
                "important"
            );


            primary.style.setProperty(
                "margin-left",
                "auto",
                "important"
            );


            primary.style.setProperty(
                "margin-right",
                "auto",
                "important"
            );




            primary.style.setProperty(
                "transform",
                "translateX(calc(5vw + 140px))",
                "important"
            );




        


        }




        // 持续监听，
        // X 是 SPA 动态加载

        if(
            !this._sidebarObserver
        ){

            this._sidebarObserver =
                new MutationObserver(
                    ()=>{


                        try{

                            this.applySidebar();

                        }
                        catch(e){

                            console.error(
                                "sidebar observer error",
                                e
                            );

                        }


                    }
                );


            this._sidebarObserver.observe(
                document.body,
                {
                    childList:true,
                    subtree:true
                }
            );

        }


    },





    /**
     * 应用左侧栏折叠
     *
     * 根据配置折叠左侧导航栏
     */
    applyLeftSidebar(){


        if(
            !Config.get(
                "collapseLeftSidebar"
            )
        ){

            return;

        }




        // 隐藏左侧导航栏

        const leftNav =
            document.querySelector(
                'header[role="banner"]'
            );


        if(leftNav){

            leftNav.style.display =
                "none";

        }




        // 主内容区居中占满

        const primary =
            document.querySelector(
                '[data-testid="primaryColumn"]'
            );


        if(primary){


            // 用 !important 强制覆盖 X 的内联样式，
            // 让主内容在 flex 中固定宽度并居中

            primary.style.setProperty(
                "width",
                "990px",
                "important"
            );


            primary.style.setProperty(
                "flex-basis",
                "990px",
                "important"
            );


            primary.style.setProperty(
                "flex-grow",
                "0",
                "important"
            );


            primary.style.setProperty(
                "flex-shrink",
                "0",
                "important"
            );


            primary.style.setProperty(
                "margin-left",
                "auto",
                "important"
            );


            primary.style.setProperty(
                "margin-right",
                "auto",
                "important"
            );




            primary.style.setProperty(
                "transform",
                "translateX(calc(5vw + 140px))",
                "important"
            );




        }




        // 持续监听，
        // X 是 SPA 动态加载

        if(
            !this._leftNavObserver
        ){

            this._leftNavObserver =
                new MutationObserver(
                    ()=>{

                        this.applyLeftSidebar();

                    }
                );


            this._leftNavObserver.observe(
                document.body,
                {
                    childList:true,
                    subtree:true
                }
            );

        }


    },







    /**
     * 关闭面板
     *
     * 被盾牌按钮、面板最小化按钮调用
     */
    closePanel(){


        const old =
            document.querySelector(
                ".txtool-panel"
            );


        if(old){

            old.remove();

        }


        // 盾牌恢复原大小

        if(
            this._floatBtn
        ){

            this._floatBtn.style.transform =
                "scale(1)";

        }


    },









    /**
     * 打开面板
     */
    openPanel(){


        const old =
            document.querySelector(
                ".txtool-panel"
            );


        if(old){


            old.remove();


            // 面板关闭，盾牌恢复原大小

            if(
                this._floatBtn
            ){

                this._floatBtn.style.transform =
                    "scale(1)";

            }


            return;

        }





        const panel =
            document.createElement(
                "div"
            );


        panel.className =
            "txtool-panel";



        panel.innerHTML = `


        <div class="txtool-header">

        <h3>
        🛡️ Twitter X Toolkit
        </h3>

        <button
        id="txt-minimize"
        class="txtool-minimize"
        title="最小化"
        >
        −
        </button>

        </div>



        <p>
        本地规则评论管理
        </p>



        <label>

        隐藏右侧栏:

        <input 
        id="txt-auto"
        type="checkbox"
        >

        </label>



        <label>

        折叠左侧栏:

        <input 
        id="txt-left"
        type="checkbox"
        >

        </label>



        <br><br>



        <label>

        自动拉黑:

        <input 
        id="txt-block"
        type="checkbox"
        >

        </label>



        <hr>



        <b>
        关键词
        </b>


        <textarea

        id="txt-keywords"

        class="txtool-input"

        rows="5"

        ></textarea>




        <button

        class="txtool-btn"

        id="txt-save"

        >

        保存配置

        </button>




        <button

        class="txtool-btn"

        id="txt-scan"

        >

        扫描评论

        </button>



        <button

        class="txtool-btn"

        id="txt-history"

        >

        查看历史

        </button>



        <button

        class="txtool-btn"

        id="txt-export"

        >

        导出历史

        </button>



        `;





        document.body.appendChild(
            panel
        );




        // 面板打开，盾牌缩小

        if(
            this._floatBtn
        ){

            this._floatBtn.style.transform =
                "scale(0.6)";

        }



        this.bindEvents();

        this.loadData();



    },









    /**
     * 加载配置
     */
    loadData(){



        document
        .querySelector(
            "#txt-auto"
        )
        .checked =
        Config.get(
            "hideSidebar"
        );



        document
        .querySelector(
            "#txt-block"
        )
        .checked =
        Config.get(
            "autoBlock"
        );




        document
        .querySelector(
            "#txt-left"
        )
        .checked =
        Config.get(
            "collapseLeftSidebar"
        );





        document
        .querySelector(
            "#txt-keywords"
        )
        .value =

        Config.get(
            "blockKeywords"
        )
        .join("\n");


    },











    /**
     * 绑定事件
     */
    bindEvents(){



        document
        .querySelector(
            "#txt-minimize"
        )
        .onclick=()=>{


            this.closePanel();


        };




        document
        .querySelector(
            "#txt-save"
        )
        .onclick=()=>{



            Config.set(

                "hideSidebar",

                document
                .querySelector(
                    "#txt-auto"
                )
                .checked

            );




            // autoBlock 二次确认：
            // 防止误操作开启自动拉黑导致账号风控

            const blockChecked =
                document
                .querySelector(
                    "#txt-block"
                )
                .checked;


            if(
                blockChecked
                &&
                !Config.get(
                    "autoBlock"
                )
            ){


                const confirmed =
                    confirm(
                        "⚠️ 开启自动拉黑存在账号风控风险\n\n"
                        +
                        "确定要开启吗？"
                    );


                if(
                    !confirmed
                ){


                    // 用户取消，回滚勾选状态

                    document
                    .querySelector(
                        "#txt-block"
                    )
                    .checked =
                    false;


                }


            }



            Config.set(

                "autoBlock",

                document
                .querySelector(
                    "#txt-block"
                )
                .checked

            );




            Config.set(

                "collapseLeftSidebar",

                document
                .querySelector(
                    "#txt-left"
                )
                .checked

            );




            Config.set(

                "blockKeywords",

                document
                .querySelector(
                    "#txt-keywords"
                )
                .value

                .split("\n")

                .filter(Boolean)

            );




            // 立即应用侧栏隐藏

            this.applySidebar();



            // 立即应用左侧栏折叠

            this.applyLeftSidebar();



            alert(
                "保存成功"
            );


        };







        document
        .querySelector(
            "#txt-scan"
        )
        .onclick=()=>{


            this.scan();


        };








        document
        .querySelector(
            "#txt-history"
        )
        .onclick=()=>{


            alert(

                JSON.stringify(

                    Config.get(
                        "history"
                    ),

                    null,

                    2

                )

            );


        };




        document
        .querySelector(
            "#txt-export"
        )
        .onclick=()=>{


            const history =
                Config.get(
                    "history"
                );


            if(
                history.length===0
            ){

                alert(
                    "暂无历史记录"
                );

                return;

            }




            // 导出为 JSON 文件下载

            const blob =
                new Blob(
                    [
                        JSON.stringify(
                            history,
                            null,
                            2
                        )
                    ],
                    {
                        type:
                        "application/json"
                    }
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            const a =
                document.createElement(
                    "a"
                );


            a.href = url;


            a.download =
                "twitter-toolkit-history-"
                +
                Date.now()
                +
                ".json";


            document.body.appendChild(
                a
            );


            a.click();


            document.body.removeChild(
                a
            );


            URL.revokeObjectURL(
                url
            );


        };



    },









    /**
     * 执行扫描
     */
    async scan(){


        const tweets =

            await CommentScanner
            .scanWithScroll();



        const matched =

            Matcher.filter(
                tweets
            );



        Blocker.executeAll(
            matched
        );


        alert(

            `处理完成:${matched.length}`

        );


    }



};

/**
 * ==========================
 * Main Module
 * 主入口
 * ==========================
 */


const Main = {



    /**
     * 初始化
     */
    init(){


        log(
            "Twitter X Toolkit starting..."
        );



        // 初始化 UI

        UI.init();



        // 页面检测

        this.observe();



        // 初始扫描

        this.delayScan();



    },









    /**
     * 延迟扫描
     *
     * 等待 X 页面加载
     */
    async delayScan(){



        await sleep(
            3000
        );



        this.scan();


    },









    /**
     * 执行扫描
     */
    async scan(){



        // 仅推文详情页执行清理，
        // 首页/时间线不自动滚动不屏蔽

        if(
            !this.isStatusPage()
        ){

            log(
                "非推文详情页，跳过扫描"
            );

            return;

        }




        try{


            const tweets =

                await CommentScanner
                .scanWithScroll();



            const matched =

                Matcher.filter(
                    tweets
                );



            if(
                matched.length
                ===0
            ){

                log(
                    "没有发现需要处理内容"
                );


                return;

            }




            Blocker.executeAll(
                matched
            );



        }
        catch(e){


            console.error(
                "scan error",
                e
            );


        }


    },











    /**
     * MutationObserver
     *
     * 监听 X 动态加载
     */
    observe(){



        const observer =
            new MutationObserver(
                mutations=>{


                    try{


                        let needScan=false;



                        for(
                            const mutation
                            of mutations
                        ){


                            if(
                                mutation.addedNodes
                                .length>0
                            ){


                                needScan=true;


                                break;

                            }


                        }



                        if(
                            needScan
                        ){


                            this.autoScan();


                        }


                    }
                    catch(e){


                        // 回调异常不影响 Observer 运行

                        console.error(
                            "observer callback error",
                            e
                        );


                    }


                }
            );







        observer.observe(

            document.body,

            {

                childList:true,

                subtree:true

            }

        );



        log(
            "Observer started"
        );


    },









    /**
     * 自动扫描防抖
     */
    autoScan(){



        clearTimeout(
            this.timer
        );



        this.timer =
            setTimeout(
                ()=>{


                    this.scan();


                },

                2500

            );



    },









    /**
     * 判断是否为推文详情页
     *
     * URL 形如 /xxx/status/123456
     */
    isStatusPage(){


        return /\/status\/\d+/.test(
            location.pathname
        );


    },




    /**
     * SPA路由监听
     *
     * X不会刷新页面
     */
    hookRouter(){



        const oldPush =
            history.pushState;



        history.pushState =
        function(){


            oldPush.apply(
                this,
                arguments
            );


            window.dispatchEvent(
                new Event(
                    "locationchange"
                )
            );


        };





        window.addEventListener(

            "locationchange",

            ()=>{


                log(
                    "route changed"
                );


                Main.delayScan();


            }

        );



    }



};









/**
 * ==========================
 * Start
 * ==========================
 */


Main.hookRouter();



if(
    document.readyState
    ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        ()=>{

            Main.init();

        }

    );


}
else{


    Main.init();


}



})();
