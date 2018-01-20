let is_running = 1;
let eti = 0, admin_i = 0, admin_pm = false, is_talking = false, i = 0;
let config = require('./config');
let talk_data_base = [];
talk_data_base[0] = require('./data/talk/dislike');
talk_data_base[1] = require('./data/talk/base');
talk_data_base[2] = require('./data/talk/like');
let fetch = require('node-fetch');
let mysql = require('mysql');

let userdata = {};
let favtype = 1;

let lastup_day = new Date().getDate();
let day_total_fav = {};

if (!config.db_host || !config.db_user || !config.db_pass || !config.db_name || !config.db_port ||
    !config.domain || !config.token ||
    !config.bot_id || !config.bot_admin) {
    console.log("ERROR!:config情報が不足しています！");
    process.exit();
}
AkariBot_main();

function AkariBot_main() {
    let db = mysql.createConnection({
        host: config.db_host,
        port: config.db_port,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    });
    db.connect();

    db.query('SELECT * FROM `userdata`', function (error, results, fields) {
        if (error) {
            console.log("DBERROR: "+error);
            db.end();
            process.exit();
        } else {
            i = 0;
            while (results[i]) {
                userdata[results[i]["name"]] = JSON.parse(results[i]["data"]);
                i++;
            }
        }
    });

    let WebSocketClient = require('websocket').client;
    let client = new WebSocketClient();

    client.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
        if (db) db.end();
    });

    client.on('connect', function(connection) {
        console.log('WebSocket Client Connected');
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
            if (db) {
                db.end();
            }
        });
        connection.on('close', function() {
            console.log('サーバとの接続が切れました。60秒後にリトライします...');
            setTimeout( function() {
                AkariBot_main();
            }, 60000);
            if (db) {
                save(true, db);
            }
            //鯖落ち
        });
        connection.on('message', function(message) {
            //console.log(message);
            try {
                if (message.type === 'utf8') {
                    let json = JSON.parse(JSON.parse(message.utf8Data).payload);
                    if (json['account']) {
                        let acct = json['account']['acct'];
                        let text = json['content'];
                        if (acct !== config.bot_id) {
                            if (is_running) {
                                if (!userdata["fav"][acct]) userdata["fav"][acct] = 50;

                                if (text.match(/(クソ|ガイジ|死|殺|21|うざ|ウザ|デブ)/i)) {
                                    userdata["fav"][acct] -= 2;
                                    console.log("@"+acct+":minus_fav");
                                } else if (text.match(/(好き|可愛い|かわいい|すき|偉い|えらい|なるほ|ありがと|有難う|やった)/i)) {
                                    let d = new Date().getDate();
                                    if (lastup_day !== d) {
                                        lastup_day = d;
                                        day_total_fav = {};
                                    }
                                    if (!day_total_fav[acct]) day_total_fav[acct] = 0;
                                    if (day_total_fav[acct] <= 20) {
                                        userdata["fav"][acct]++;
                                        day_total_fav[acct]++;
                                        console.log("@" + acct + ":plus_fav");
                                    }
                                }

                                if (userdata["fav"][acct] < 20) favtype = 0;
                                else if (userdata["fav"][acct] < 100) favtype = 1;
                                else if (userdata["fav"][acct] < 200) favtype = 2;
                                //else if (userdata["fav"][acct] >= 200) favtype = 3;

                                //終了
                                if (text.match(/!stop/i)) {
                                    admin_i = 0;
                                    admin_pm = false;

                                    while (config.bot_admin[admin_i]) {
                                        if (acct === config.bot_admin[admin_i]) admin_pm = true;
                                        admin_i++;
                                    }

                                    if (admin_pm) {
                                        if (acct !== config.bot_admin[0]) {
                                            post("@"+acct+" @"+config.bot_admin[0]+" 終了しました。", {}, "direct");
                                        }
                                        post("そろおち～", {}, "public", true);
                                        change_running(0);
                                        console.log("OK:STOP:@"+acct);
                                        save(false, db);
                                    }
                                }

                                //話題感知
                                if (text.match(/(ねじり|わさび|ねじわさ|KnzkApp|神崎丼アプリ)/i)) {
                                    post("@"+config.bot_admin[0]+" ねじり検知", {in_reply_to_id: json['id']}, "direct");
                                    rt(json['id']);
                                    console.log("OK:match:"+acct);
                                }

                                //こおりたそと一緒にエタフォ
                                if (text.match(/エターナルフォースブリザード/i) && userdata["fav"][acct] > 20) {
                                    post("@"+acct+" 私も.....！！！", {in_reply_to_id: json['id']});
                                    eti = 0;
                                    etfav(json['id']);
                                    console.log("OK:エタフォ:"+acct);
                                }

                                //メイン部分
                                if (text.match(/(a!|あかり)/i)) {
                                    is_talking = false;
                                    rt(json['id']);

                                    if (text.match(/(URL|リンク|短縮)/i) && config.urlshort_api) {
                                        URL(json);
                                        is_talking = true;
                                    }

                                    if (text.match(/(保存|セーブ)/i)) {
                                        admin_i = 0;
                                        admin_pm = false;

                                        while (config.bot_admin[admin_i]) {
                                            if (acct === config.bot_admin[admin_i]) admin_pm = true;
                                            admin_i++;
                                        }

                                        if (admin_pm) {
                                            save(false, db);
                                            console.log("OK:SAVE:@"+acct);
                                        }
                                        is_talking = true;
                                    }
                                    
                                    if (text.match(/(リロード|再起動)/i)) {
                                        admin_i = 0;
                                        admin_pm = false;

                                        while (config.bot_admin[admin_i]) {
                                            if (acct === config.bot_admin[admin_i]) admin_pm = true;
                                            admin_i++;
                                        }

                                        if (admin_pm) {
                                            save(false, db);
                                            console.log("OK:SAVE:@"+acct);
                                        }
                                        is_talking = true;
                                    }


                                    //埋める
                                    if (text.match(/埋め(たい|ろ|て)/i)) {
                                        let name = "", postm = 0, postd = 0;

                                        if (text.match(/(神崎|おにいさん|お兄さん)/i)) {
                                            name = "knzk";
                                        } else {
                                            post("@"+acct+" ごめんね、今は神埼おにいさん以外埋められないの...", {in_reply_to_id: json['id']}, "direct");
                                        }
                                        if (name === "knzk") {
                                            postd = 1;
                                            postm = 0;
                                        }

                                        if (postm) {
                                            post(umeume(4, name));
                                            console.log("OK:埋める:"+acct);
                                        } else if (postd) {
                                            post(umeume(20, name), {cw: "ｺﾞｺﾞｺﾞｺﾞｺﾞｺﾞ..."});
                                            console.log("OK:埋める(岩盤):"+acct);
                                        }
                                        is_talking = true;
                                    }

                                    //たこ焼き (ちょくだいさんに無能扱いされたので)
                                    if (text.match(/たこ(焼き|やき)/i) && text.match(/((焼|や)いて|(作|つく)って|(食|た)べたい|ちょ(ー|～|う|く)だい|(欲|ほ)しい|お(願|ねが)い)/i)) {
                                        setTimeout(function () {
                                            if (userdata["fav"][acct] > 20) {
                                                post("@"+acct+" たこ焼きど～ぞ！\n\n" +
                                                    "[large=5x]:takoyaki:[/large]");
                                            } else {
                                                post("@"+acct+" えぇ...あなたにはちょっと...", {in_reply_to_id: json['id']});
                                            }
                                        }, 5000);
                                        console.log("OK:takoyaki:"+acct);
                                        is_talking = true;
                                    }

                                    if (!is_talking) {
                                        i = 0;

                                        while (talk_data_base[favtype].talkdata_base[i]) {
                                            if (text.match(new RegExp(talk_data_base[favtype].talkdata_base[i][0], 'i'))) {
                                                post("@"+acct+" "+talk_data_base[favtype].talkdata_base[i][1], {in_reply_to_id: json['id']});
                                            }
                                            i++;
                                        }
                                    }
                                }
                            } else {
                                if (acct === config.bot_admin[0]) {
                                    if (text.match(/!start/i) || text.match(/あかり(ちゃん|たそ)(起動|おきて|起きて)/i)) {
                                        change_running(1);
                                        post("おはおは～");
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                post("@"+config.bot_admin[0]+" 【エラー検知】\n\n"+ e, {}, "direct", true);
                save(false, db);
                post("ごほっ、ごほっ...\n" +
                    "ちょっと体調悪いから休む...\n\n" +
                    "【エラーが発生したため停止します】");
                change_running(0);
            }
        });
    });

    client.connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public:local");
}


// ここからいろいろ
function save(end, db) {
    db.query('UPDATE `userdata` SET `data` = ? WHERE `userdata`.`name` = \'fav\'', [JSON.stringify(userdata["fav"])], function (err, result) {
        if (end) db.end();
    });
}

function umeume(depth, name) {
    let res = "", is_bedrock = false, i = 0;
    if (depth > 4) is_bedrock = true;
    depth -= 3;
    res = ":minecraft_dirt:​:minecraft_dirt:​:minecraft_dirt:​:minecraft_dirt:​:minecraft_dirt:\n";

    while (i <= depth) {
        res += ":minecraft_stone:​:minecraft_stone:​:minecraft_stone:​:minecraft_stone:​:minecraft_stone:\n";
        i++;
    }

    res += ":minecraft_stone:​:minecraft_stone:​:"+name+":​:minecraft_stone:​:minecraft_stone:\n";
    res += is_bedrock ? ":minecraft_bedrock:​:minecraft_bedrock:​:minecraft_bedrock:​:minecraft_bedrock:​:minecraft_bedrock:" : ":minecraft_stone:​:minecraft_stone:​:minecraft_stone:​:minecraft_stone:​:minecraft_stone:";
    return res;

}

function URL(json) {
    post("@"+json['account']['acct']+" 送信してるから数十秒まっててねー！", {in_reply_to_id: json['id']});
    setTimeout( function() {
        fetch("https://" + config.domain + "/api/v1/statuses/"+json['id']+"/card", {
            method: 'GET'
        }).then(function(response) {
            if(response.ok) {
                return response.json();
            } else {
                console.warn("NG:url_card:SERVER");
                return null;
            }
        }).then(function(json_url) {
            if (json_url) {
                if (json_url["url"]) {
                    fetch("https://" + config.urlshort_api + "?akari_id=Akari_"+json['account']['acct']+"&url="+encodeURIComponent(json_url["url"]), {
                        method: 'GET'
                    }).then(function(response) {
                        if(response.ok) {
                            return response.text();
                        } else {
                            post("@"+json['account']['acct']+" @"+config.bot_admin[0]+" APIにアクセスできなかった...", {in_reply_to_id: json['id']}, "direct");
                            console.warn("NG:url:SERVER");
                            return null;
                        }
                    }).then(function(text) {
                        if (text.match(/http/i)) {
                            post("@"+json['account']['acct']+" はいど～ぞ！\n"+text, {in_reply_to_id: json['id']});
                        } else {
                            post("@"+json['account']['acct']+" @"+config.bot_admin[0]+" 何か失敗したみたい... エラー:"+text, {in_reply_to_id: json['id']}, "direct");
                            console.warn("NG:url:"+json);
                        }
                    });
                } else {
                    post("@"+json['account']['acct']+" ...？\nURLが取得できなかった...", {in_reply_to_id: json['id']});
                }
            }
        });
    }, 20000);
}

function etfav(id) {
    fetch("https://" + config.domain + "/api/v1/statuses/"+id+"/favourite", {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'POST'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            console.warn("NG:fav:SERVER");
            return null;
        }
    }).then(function(json) {
        if (json) {
            if (json["id"]) {
                console.log("OK:fav");
                fetch("https://" + config.domain + "/api/v1/statuses/"+id+"/unfavourite", {
                    headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
                    method: 'POST'
                }).then(function(response) {
                    if(response.ok) {
                        return response.json();
                    } else {
                        console.warn("NG:fav:SERVER");
                        return null;
                    }
                }).then(function(json) {
                    if (json) {
                        if (json["id"]) {
                            console.log("OK:fav");
                            if (eti < 20) {
                                etfav(id);
                                eti++;
                            }
                        } else {
                            console.warn("NG:fav:"+json);
                        }
                    }
                });
            } else {
                console.warn("NG:fav:"+json);
            }
        }
    });
}


function rt(id) {
    fetch("https://" + config.domain + "/api/v1/statuses/"+id+"/reblog", {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'POST'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            console.warn("NG:RT:SERVER");
            return null;
        }
    }).then(function(json) {
        if (json) {
            if (json["id"]) {
                console.log("OK:RT");
            } else {
                console.warn("NG:RT:"+json);
            }
        }
    });
}

function post(value, option = {}, visibility = "public", force) {
    var optiondata = {
        status: value,
        visibility: visibility
    };

    if (option.cw) {
        optiondata.spoiler_text = option.cw;
    }
    if (option.in_reply_to_id) {
        optiondata.in_reply_to_id = option.in_reply_to_id;
    }
    if (is_running || force) {
        fetch("https://" + config.domain + "/api/v1/statuses", {
            headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
            method: 'POST',
            body: JSON.stringify(optiondata)
        }).then(function(response) {
            if(response.ok) {
                return response.json();
            } else {
                console.warn("NG:POST:SERVER");
                return null;
            }
        }).then(function(json) {
            if (json) {
                if (json["id"]) {
                    console.log("OK:POST");
                } else {
                    console.warn("NG:POST:"+json);
                }
            }
        });
    }
}

function change_running(mode) {
    if (mode === 1) {
        is_running = 1;
        console.log("OK:START");
    } else {
        is_running = 0;
        console.log("OK:STOP");
    }
}