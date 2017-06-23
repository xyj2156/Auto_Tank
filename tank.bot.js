/*
    炮弹，坦克 预制对象存储
*/
var BOT = {
    '机枪型':[
            {
            power:2,
            sight:140,
            length:30,
            width:4,
            rot:3,
            timeout:100,
            exp:200,
            lv:0,
            update:false,
            accuracy:0.6
        },
        {
            power:3,
            sight:185,
            length:32,
            width:5,
            rot:4,
            timeout:50,
            exp:350,
            lv:1,
            update:false,
            accuracy:0.75
        },
        {
            power:5.5,
            sight:220,
            length:35,
            width:6,
            rot:5,
            timeout:30,
            exp:false,
            lv:2,
            update:false,
            accuracy:0.8
        }
    ],
    '狙击型':[
        {
            power:50,
            sight:340,
            length:40,
            width:5,
            rot:1,
            timeout:2000,
            exp:200,
            lv:0,
            update:false,
            accuracy:0.9
        },
        {
            power:100,
            sight:380,
            length:42,
            width:6,
            rot:2,
            timeout:1800,
            exp:450,
            lv:1,
            update:false,
            accuracy:0.93
        },
        {
            power:150,
            sight:400,
            length:45,
            width:7,
            rot:3,
            timeout:1500,
            exp:false,
            lv:2,
            update:false,
            accuracy:0.95
        }
    ],
    '火箭炮':[
        {
            power:100,
            sight:240,
            length:40,
            width:15,
            rot:1,
            timeout:4500,
            exp:200,
            lv:0,
            update:false,
            accuracy:0.6
        },
        {
            power:200,
            sight:280,
            length:42,
            width:16,
            rot:1.5,
            timeout:3500,
            exp:350,
            lv:1,
            update:false,
            accuracy:0.65
        },
        {
            power:250,
            sight:300,
            length:45,
            width:17,
            rot:2,
            timeout:3000,
            exp:false,
            lv:2,
            update:false,
            accuracy:0.75
        }
    ]
};


var tank = {
            'team':false,
            'image':'MCV',
            'moving':true,
            'lineing':true,
            'sefing':true,
            'sight':200,
            //'targetPosition':{
            ////    x:200,
            //    y:200
            //},
            'speed':1,
            'deg':false,
            'player':'AI',
            //'techLevel':0, //科技等级 用lv 代替
            'position':{
                x:50,
                y:90
            },
            'size':20,
            'pursuitRange':270,
            'stoped':false,
            'strength':800,
            'exp':(function(b){
                var a = [];
                for(var i = 1;i <= b; i++){
                    a[i-1] = (i+15)*10;
                    if(a[i-2]) a[i-1] +=a[i-2];
                }
                a[b+1] = false;
                return a;
            }(20)),
            'lv':0,
            'rot':5
        };