'use strict'
/*
    Box     canvas DOM对象
    player  玩家 默认AI
    坦克名字
    
    
    坦克分析
    初始化属性---》启动坦克==》获取敌人数组==》炮塔指向最近的==》开火==》结束==》循环启动坦克后
    
    敌人获取---》战场对象把所有敌人传进来，有自身选择敌人，并指向 追击敌人
    开火范围 --》 
    
    hurtOut  对某 Id 输出伤害 其中有一个 all 属性 输出总伤害。
    hurtIn 来自某 id 的伤害
    参数说明
    {   
        box：       战场 canvas DOM 对象
        team：      组、队
        image：     图片
        strength：  生命
        moving:     是否移动
        sight：     视野范围
        bot:{
            Owen：坦克对象
            power：火力
            sight：攻击范围
        }
        speed：     移动速度
        deg：       移动方位 0-2π
        timeout     装弹时间 ms
        dead:       是否死亡
        player：    玩家、AI
        targetPosition:{ 敌人坐标
            x:  
            y:
        }
        pursuitRange 追击范围
        lv          等级
        // 可能添加
        bot         炮塔
        在bot 对象上面
            整个对象类似
            炮塔对象：{
                '炮塔1':[
                    {
                        0级炮塔属性
                    },
                    {
                        1级炮塔属性
                    },
                    {
                        2级炮塔属性
                    },
                ],
                '炮塔2':[
                    {
                        0级炮塔属性
                    },
                    {
                        1级炮塔属性
                    },
                    {
                        2级炮塔属性
                    },
                ],
                '炮塔3':[
                    {
                        0级炮塔属性
                    },
                    {
                        1级炮塔属性
                    },
                    {
                        2级炮塔属性
                    },
                ]
            }
    }
    
    坦克 转弯分析 既然游戏就不要太认真了，不做了  碰撞问题不好解决、
*/


function Tank(options){
    for(var i in options)if(options.hasOwnProperty(i))this[i] = options[i];
    
    // 剩余属性初始化
    this.init();
}

Tank.prototype = {
    init:function(){
        /*********************************************************************************
            在战场初始化坦克的时候 给坦克附加上就行
        this.cxt=this.box.getContext("2d");
        
            战场对象构造坦克的时候，把战场对象附加到坦克对象的 parent 属性上
                                    canvas 的宽高也赋值到坦克对象的 width height 属性上
                                    HP 记录 初始的坦克血量
                                    炮塔 bot 属性也是有战场构造坦克的时候初始化
        
        **********************************************************************************/
        // 颜色随机  圆颜色 线颜色
        this.arcColor = this.randomColor();
        this.lineColor = this.randomColor();
        this.deg = this.deg || this.getDeg();
        
        /********************************************************
            start 方法中更新炮塔的时候 也修改了一下
        *********************************************************/
        // 设置炮塔
        this.gun = new Bot(BOT[this.bot][0]);
        this.gun.deg = this.deg;
        // 初始化就可以开火 
        this.gun.fire = true;
        
        // 暂时这样写 根据炮塔射击范围设定 视野范围和追击范围
        this.sight = this.sight > this.gun.sight?this.sight:this.gun.sight;
        this.pursuitRange = this.pursuitRange > this.gun.sight?this.pursuitRange:this.gun.sight;
        
        // 伤害对象
        this.hurtIn = {};
        this.hurtOut = {};
        this.hurtOut.all = 0;
        this.hurtIn.all = 0;
        
        // 把视野,追击，开火 范围加上自身半径 就相当于自身半径已经不算在视野范围内了
        this.sight += this.size;
        this.gun.sight += this.size;
        this.pursuitRange += this.size;
        
        // 初始化开枪次数
        this.shoot = 0;
        // 打中次数
        this.hit = 0;
        
        this.getSpeed();
        this.id = 'Jief_' + getId();
        this.position = {x:Math.random()*(this.width - 2*this.size)+this.size,y:Math.random()*(this.height - 2*this.size)};
        // this.deg = this.deg*180/Math.PI;
    },
    // 由战场对象传进来的坦克数组做参数
    getFoe:function(tankList){
        // 判断敌人是否在 追击范围内
        if (this.foe && !this.isDead()) {
            var m = this.foe.position.x - this.position.x;
            var n = this.foe.position.y - this.position.y;
            if( Math.sqrt(m*m + n*n) < this.pursuitRange){
                return this.foe;
            }
        }
        /*
            选择敌人，根据距离远近，
            根据 炮塔的角度选择敌人
                夹角最小计算分析 把炮塔看作坐标系的 0 度
        */
        var num = 7;
        var k;
        for(var i = 0;i < tankList.length; i++){
            if(tankList[i] === this) continue;
            var x = tankList[i].position.x - this.position.x;
            var y = tankList[i].position.y - this.position.y;
            var z = Math.sqrt(x*x + y*y);
            var gunDeg = this.gun.deg;
            // 转换弧度 为 -π ~ π
            gunDeg -= Math.PI;
            var deg = Math.abs(tankList[i].deg + gunDeg);
            if(this.sight >= z && deg <= num){
                num = deg;
                k = i;
            }
        }
        return tankList[k];
    },
    getDeg:function(x,y){
        if(x && y){
            var deg = Math.atan2(x,y);
            return deg < 0?deg + 2*Math.PI:deg;
        }
        return Math.random()*2*Math.PI;
    },
    randomColor:function(){
        var r = Math.random;
        var m = parseInt;
        return 'rgba('+ m(r()*255) +','+ m(r()*255) +','+ m(r()*255) +',0.7)';
    },
    getSpeed:function(){
        this.speedX = Math.sin(this.deg)*this.speed;
        this.speedY = Math.cos(this.deg)*this.speed;
    },
    draw:function(){
        // 画坦克外圈
        this.drawArc('',3);
        // 画坦克内圈
        this.drawArc(5,3);
        // 画感知敌人范围
        // this.drawArc(this.sight,1);
        // 画攻击范围
        //this.drawArc(this.gun.sight,1.5);
        // 画追击范围
        //this.drawArc(this.pursuitRange,0.5);
        // 坦克方向
        this.drawDeg();
        this.drawLine();
        this.drawText(this.id + ' 等级： ' + (this.lv+1) +' 生命：'+(parseInt(this.strength*100)/100),this.position.x,this.position.y - this.size - 10);
        this.drawMessage();
        if(!this.stoped || !this.targetPosition)this.update();
    },
    drawArc:function  (m,n) {
        var cxt = this.cxt;
        var r = m || this.size;
        var s = this.position;
        var n = n || 3;
        cxt.beginPath();
        cxt.lineWidth = n;
        cxt.strokeStyle = this.arcColor;
        cxt.arc(s.x,s.y,r,0,2*Math.PI);
        cxt.stroke();
    },
    drawLine:function(m,xx,yy){
        var cxt = this.cxt;
        var s = this.position;
        cxt.beginPath();
        cxt.strokeStyle = this.lineColor;
        cxt.lineWidth = m || this.gun.width;
        var x = Math.sin(this.gun.deg)*this.gun.length;
        var y = Math.cos(this.gun.deg)*this.gun.length;
        this.gun.x = s.x + x;
        this.gun.y = s.y + y;
        cxt.moveTo(s.x,s.y);
        cxt.lineTo((xx || s.x + x),(yy || s.y + y));
        cxt.stroke();
    },
    drawDeg:function(){
        var cxt = this.cxt;
        var s = this.position;
        cxt.beginPath();
        cxt.strokeStyle = this.lineColor;
        cxt.lineWidth = this.size*2;
        var x = Math.sin(this.deg)*this.size;
        var y = Math.cos(this.deg)*this.size;
        
        cxt.moveTo(s.x,s.y);
        cxt.lineTo(s.x + x,s.y + y);
        cxt.stroke();
    },
    drawText:function(txt,x,y,font,align){
        var cxt = this.cxt;
		cxt.beginPath();
        // var width = txt.length*12;
        // width = cxt.measureText(txt).width;
        cxt.fillStyle = 'rgba(128,128,65,1)';
        // cxt.fillRect(x-width/2,y-20,width,20);
        // cxt.fillStyle = 'black';
        cxt.font = font || '10px 微软雅黑';
        cxt.textAlign = align || "center";
        cxt.fillText(txt,x,y);
    },
    update:function(){
        if(this.stoped)return;
        var p = this.position;
        p.x += this.speedX;
        p.y += this.speedY;
        if(p.x < this.size || p.x > this.width - this.size) this.speedX = -this.speedX;
        if(p.y < this.size || p.y > this.height - this.size) this.speedY = -this.speedY;
        if(this.speedX !== 0 || this.speedY !== 0){
            var deg = this.getDeg(this.speedX,this.speedY);
        }else{
            var deg = this.degS;
        }
        this.deg = deg;
    },
    start:function  (tankList) {
        // 更新炮塔属性
        if(this.gun.update){
            console.log(this.id + ' 炮塔升级');
            // 获取 炮台属性
            var gun = new Bot(BOT[this.bot][this.gun.lv]);
            (function  (gun,obj) {
                for(var i in obj){
                    if(obj.hasOwnProperty(i))gun[i] = obj[i];
                }
            }(this.gun,gun));

            // 更新开火范围
            this.gun.sight += this.size;
            
            // 暂时这样写 根据炮塔射击范围设定 视野范围和追击范围
            this.sight = this.sight > this.gun.sight?this.sight:this.gun.sight;
            this.pursuitRange = this.pursuitRange > this.gun.sight?this.pursuitRange:this.gun.sight;
            
            // 把视野,追击，开火 范围加上自身半径 就相当于自身半径已经不算在视野范围内了
            this.sight += this.size;
            this.gun.sight += this.size;
            this.pursuitRange += this.size;
        }
        // 获取敌人
        var foe = this.getFoe(tankList);
        
        // 画方法
        this.draw();
        
        // 有敌人且敌人已经死了
        if(this.foe && this.foe.isDead()){
            this.stoped = false;
            // this.getSpeed();
        }
        // 获取的敌人不存在
        if(!foe){
            // 敌人不存在 坦克敌人为false;
            this.foe = false;
            var z = this.deg;
            this.stoped = false;
        }else {
            // 敌人存在 获取的敌人赋值给自己
            this.foe = foe;
            // 获取坐标
            var x1 = this.position.x;
            var y1 = this.position.y;
            var x2 = foe.position.x;
            var y2 = foe.position.y;
            
            // 获取方位 角度
            var x = x2-x1;
            var y = y2-y1;
            var z = this.getDeg(x,y);
            z = z < 0?z+2*Math.PI:z;
            // 获取敌人距离 是否停止
            var length = Math.sqrt(x*x + y*y);
        }
        
        // 转动炮口
        this.turnGun(z);
        
        // 计算与目标点相关
        if(this.targetPosition && this.targetPosition.x){
            var xxx = this.targetPosition.x - this.position.x;
            var yyy = this.targetPosition.y - this.position.y;
            this.deg = this.getDeg(xxx,yyy);
            var lengthh = Math.sqrt(xxx*xxx + yyy*yyy);
            
			this.stoped = false;
            if(lengthh < 5){
                this.targetPosition = false;
            }
        }else {
            // 与敌人距离小于攻击距离
            if(length < this.gun.sight){
                this.stoped = true;
                this.degS = this.deg;
                // this.speedX = 0;
                // this.speedY = 0;
            // 与敌人距离小于感知距离距离
            }else if(length < this.pursuitRange){
                this.stoped = false;
                this.deg = z;
            }
        }
        
        this.getSpeed();
    },
    isDead:function(){
        if(this.dead || this.strength <= 0){
            this.dead = true;
            this.position = false;
            
            return true;
        }
        return false;
    },
    fire:function(obj){
        var me = this;
        if(!obj && !obj.position)return;
        var x = obj.position.x - this.position.x;
        var y = obj.position.y - this.position.y;
        var z = Math.sqrt(x*x + y*y);
        if(me.gun.fire && z < me.gun.sight){
            // 开枪次数
            this.shoot ++;
            // 设置 下次开火时间
            me.gun.fire = false;
            window.setTimeout(function(){me.gun.fire = true;},me.gun.timeout);
            /*********************************
                根据准确度判断是否打中敌人
            **********************************/
            if(Math.random() > this.gun.accuracy){this.setMessage('我操，没打中。'+ obj.id +'躲的够快。');return;}
            // 命中次数
            this.hit ++;
            var power = me.gun.power;
            me.drawLine(me.gun.width*0.8,obj.position.x,obj.position.y);
            power = power*0.7 + power*0.3*Math.random();
            if(Math.random() > 0.95){
                power += power *= Math.random();
                if(power > me.gun.power+1){
                    this.setMessage('对 ' + me.foe.id + ' 造成暴击伤害 ' + (parseInt(power*100)/100));
                }
            }
            
            obj.strength -= power;
            
            // 承受伤害和输出伤害
            obj.hurtIn[me.id] ? obj.hurtIn[me.id] += power : obj.hurtIn[me.id] = power;
            obj.hurtIn.all += power;
            
            me.hurtOut[obj.id] ? me.hurtOut[obj.id] += power : me.hurtOut[obj.id] = power;
            me.hurtOut.all += power;
            
            
            if(obj.strength <= 0 ){
                this.parent.setMessage(me.id + ' 用 '+ me.bot + ' 打死了 ' + obj.id + '，' + obj.id  + ' 使用' + obj.bot);
            }
            // 升级炮塔 根据总伤害计算
            if(me.hurtOut.all > me.gun.exp && me.gun.exp){
                me.gun.lv ++;
                me.gun.update = true;
				me.setMessage( this.player + '太牛逼了，炮塔升级了。当前'+ (me.gun.lv+1) +'级。');
            }
            // 坦克升级方法
            if((me.hurtOut.all + me.hurtIn.all*0.3 > me.exp[me.lv]) && me.exp[me.lv]){
                me.lv ++;
                me.strength += me.strength *= (me.lv)/100;
                me.setMessage('坦克升级到'+ (me.lv+1) +'级。');
            }
            // 以后升级装甲 也是这里计算
        }
    },
    drawMessage:function(){
        var txt = this.message;
        if(!txt)return;
        this.drawText(txt,this.position.x,this.position.y - this.size - 30,'16px 微软雅黑');
    },
    turnGun:function(z){
        var deg = this.gun.deg;
        var rot = this.gun.rot;
        var pi2 = Math.PI*2;
        /****************************************
            新方法的弊端，最终值达到后，炮口老是晃动
        *****************************************
        if(z > deg){
            z-deg < Math.PI? deg += rot: deg -= rot;
        }else{
            deg-z <Math.PI? deg -= rot: deg += rot;
        }
        deg = deg<0 ? pi2 + deg:deg>pi2?deg - pi2:deg;
        if (Math.abs(z-deg) < this.gun.rot){
            deg = z;
            // 开火
            this.fire(this.foe);
        }
        this.gun.deg = deg;
        return;
        */
        
        // 下面是旧方法 
        /****************************************
        
            由于旧方法的弊端采取新旧结合 对面象限 用新方法    现在感觉完美了
            
        ****************************************/
        // 获取象限
        var xx = get(deg);
        var yy = get(z);
        var angle = z-deg>0;
        // console.log({'自己象限':{'象限':xx,'角度':deg*180/Math.PI,'x':x1,'y':y1}, '敌人象限' :{'象限': yy,'角度':z*180/Math.PI,'x':x2,'y':y2},'敌人所在角度':z*180/Math.PI,'自己颜色':this.arcColor,'坐标x':x,'坐标y':y});
        // 同一象限
        /*
            象限分析    同一象限 判断敌人在炮口的哪一个侧面，然后判断加或者减
                        敌人 在炮口的 前一个象限 根据角度差值绝对值
        */
        if (xx === yy) {
            if (z-deg > 0) {
                deg += rot;
            }else if (z-deg<0) {
                deg -= rot;
            }
        }else {
            if (z > deg) {
                z-deg < Math.PI? deg += rot: deg -= rot;
            }else {
                deg-z <Math.PI? deg -= rot: deg += rot;
            }
        }
        
        if (Math.abs(z-deg) < this.gun.rot){
            deg = z;
            // 开火
            this.fire(this.foe);
        }
        deg = deg<0?2*Math.PI + deg:deg>2*Math.PI? deg - 2*Math.PI:deg;
        this.gun.deg = deg;
         
        /*
            根据角度获取象限
        */
        function get (angle) {
            var pi = Math.PI;
            angle = angle%(2*pi);
            return angle < pi/2?4:angle < pi?1:angle < pi*3/2?2:3;
        }
    },
    // 设置顶部显示信息 内容，显示时间
    setMessage:function  (txt,time) {
        var me = this;
        me.message = txt;
        time = time || 3000;
        if(me.textStop){
            window.clearTimeout(me.textStop);
        }
        me.textStop = window.setTimeout(function(){
            me.message = '';
            me.textStop = 0;
        },time);
    },
	setTargetPosition:function(x,y){
		this.targetPosition = this.targetPosition || {};
		this.targetPosition.x = x;
		this.targetPosition.y = y;
	}
};


var getId = (function(){
    var i = 0;
    return function(){
        return i++;
    };
}());

/*
    炮塔类
    把旋转角度修改成弧度制
*/
function Bot(bot){
    for(var i in bot)if(bot.hasOwnProperty(i))this[i] = bot[i];
    // 角度转弧度
    this.rot = this.rot * Math.PI/180;
}

function test (array) {
    var a = {};
    for(var i = 0;i < arr.length;i++){
        a[array[i]] = '新年到，红包拿来。';
    }
    array = [];
    for(var i in a){
        array[array.length] = i;
    }
    return array;
}