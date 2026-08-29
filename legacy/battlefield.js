'use strict'

function Battlefield(options){
    for(var i in options)if(options.hasOwnProperty(i))this[i] = options[i];
    this.options = options;
    this.init();
}
Battlefield.prototype = {
    init:function(){
        var me = this;
        this.cxt = this.box.getContext('2d');
        this.createMap();
        this.click();
        // 战场 选择矩形
        this.rect = {};
		// 选择坦克数组为空
		this.selected([]);
        this.play();
    },
    createMap:function(){
        this.map = [];
        for(var i = 0;i < this.num;i++){
            this.map[this.map.length] = this.createTank(tank);
        }
    },
    draw:function(){
        var me = this;
        // this.cxt.fillStyle = 'rgba(0,0,0,.2)';
        this.cxt.clearRect(0,0,this.box.width,this.box.height);
        // this.cxt.fillRect(0,0,this.box.width,this.box.height);
        for(var i = 0;i < this.map.length;i++){
            if(this.map[i].isDead() && this.map.length !== 1){
                this.map.splice(i,1);
            }else if(this.map.length !== 1){
                this.map[i].start(this.map);
                me.end = false;
            }else{
                this.map[i].start(this.map);
                if(!this.end && !this.test){
                    me.message.text = me.map[0].id + ' 胜出，是最后幸运者。';
                    this.end = window.setTimeout(function(){me.createMap();me.selected.all=[];me.end = true;},3000);
                }
            }
        }
        // 显示消息
        this.message(3000);
        // 画 选择框
        this.drawRect();
        // 判断是否选择坦克
        if(this.selected.all.length !== 0){
            var all = this.selected.all;
            var n = 0;
            for(var i = 0;i < all.length;i++){
                if(all[i].isDead())continue;
                this.drawTankProperty(all[i],n*300+240,40);
                n++;
            }
        }
    },
    createTank:function(tank){
        // 预处理 添加战场对象
        tank.parent = this;
        // canvas 对象
        // 记录初始血量
        
        // 暂时这样写 随机选择炮塔
        var random = Math.random();
        tank.bot = random<0.33?'狙击型':random<0.66?'机枪型':'火箭炮';
        
        tank.HP = tank.strength;
        tank.width = this.box.width;
        tank.height = this.box.height;
        tank.cxt = this.box.getContext("2d");
        
        return this.map[this.map.length] = new Tank(tank);
    },
    message:function(){
        var mes = this.message,cxt = this.cxt;
		if(!mes.text)return;
        // 内容是否改变
		if(mes.change){
            // 如果改变 清除定时器，并重新设置。
			window.clearTimeout(mes.stop);
            mes.stop = window.setTimeout(function(){
                mes.text = false;
            },mes.time);
            // 更新改变状态
			mes.change = false;
		}
        var width = mes.text.length*30;
		cxt.beginPath();
        cxt.fillStyle = 'purple';
		cxt.font = mes.font;
		cxt.textAlign = mes.align;
		cxt.fillText(mes.text,this.box.width/2,mes.top -= 0.5);
        cxt.fillStyle = 'rgba(245,245,65,.2)';
        cxt.fillRect((this.box.width - width)/2,mes.top-30,width,40);
    },
	setMessage:function(text,time,font,top,align){
		var mes = this.message;
		mes.text = text;
		// 标记内容改变
		mes.change = true;
		mes.top = top || 150;
		mes.font = font || '30px 微软雅黑';
		mes.align = align || 'center';
		mes.time = time || 3000;
	},
    play:function  mm() {
        var me = this;
        me.draw();
        me.stop = window.requestAnimationFrame(function  () {
            me.play();
        });
    },
	stops:function(){
		window.cancelAnimationFrame(this.stop);
	},
    drawRect:function(){
        var cxt = this.cxt;
        if(!this.rect)return;
		cxt.beginPath();
        cxt.lineWidth = 1;
        cxt.strokeStyle = 'green';
        cxt.fillStyle = 'rgba(0,0,0,.3)';
        cxt.rect(this.rect.x,this.rect.y,this.rect.width,this.rect.height);
        cxt.fill();
        cxt.stroke();
		cxt.closePath();
    },
    // 鼠标事件
    click:function  () {
        var me = this;
        var box = me.box;
        var lx,ly,width,height;

        box.addEventListener('mousedown',down);
        function down (e) {
            var range = box.getClientRects()[0];
            lx = e.clientX - range.left;
            ly = e.clientY - range.top;
            box.addEventListener('mousemove',move);
            box.addEventListener('mouseup',up);
        }
        
        function move (e) {
            width = e.clientX - lx;
            height = e.clientY - ly;
            me.rect = {
                'x':lx,
                'y':ly,
                'width':width,
                'height':height
            };
        }
        
        function up (e) {
			var select = {'x':lx,'y':ly,'width':width,'height':height};
			var selected = me.getSelect(select);
			var selectedAll = me.selected.all;
			if(width > 5 || selected){
				me.selected(selected);
			}else{
				for(var i = 0 ;i < selectedAll.length;i++){
					selectedAll[i].setTargetPosition(lx,ly);
				}
			}
			me.rect = false;
            box.removeEventListener('mousemove',move);
            box.removeEventListener('mouseup',up); 
        }
    },
	// 选择坦克（根据点击或者选框）
    selected:function  (obj) {
        this.selected.all = obj;
    },
    getSelect:function  (obj) {
        var cxt = this.cxt;
        if(!obj.width || obj.width < 5){
            for(var i = 0;i < this.map.length; i++){
				cxt.beginPath();
                cxt.arc(this.map[i].position.x,this.map[i].position.y,this.map[i].size,0,2*Math.PI);
				cxt.closePath();
                if (cxt.isPointInPath(obj.x,obj.y) && !this.map[i].isDead()) {
                    return [this.map[i]];
                }
            }
        }else {
            var select = [];
			cxt.beginPath();
            cxt.rect(obj.x,obj.y,obj.width,obj.height);
			cxt.closePath();
            for(var i = 0;i < this.map.length; i++){
                var a = this.map[i];
                var x = a.position.x;
                var y = a.position.y;
                var z = a.size;
                
                if (cxt.isPointInPath(x-z,y-z) || cxt.isPointInPath(x+z,y-z) || cxt.isPointInPath(x-z,y+z) || cxt.isPointInPath(x+z,y+z)) {
                    if(!a.isDead())select[select.length] = a;
                }
            }
            return select;
        }
    },
    drawTankProperty:function(tank,x,y){
        var cxt = this.cxt;
        cxt.font = '14px 宋体';
        cxt.textAlign = 'left';
        cxt.beginPath();
        
        cxt.fillStyle = 'purple';
        var i = 0;
        var height = 17;
        cxt.fillText('      id：' + tank.id,x,y+i*height);
        i++;
        cxt.fillText('坦克等级：' + (tank.lv+1),x,y+i*height);
        i++;
        cxt.fillText('炮塔等级：' + (tank.gun.lv+1),x,y+i*height);
        i++;
        cxt.fillText('武器类型：' + tank.bot,x,y+i*height);
        i++;
        cxt.fillText('    生命：' + parseInt(tank.strength*100)/100,x,y+i*height);
        i++;
        cxt.fillText('  攻击力：' + tank.gun.power,x,y+i*height);
        i++;
        cxt.fillText('    速度：' + tank.speed,x,y+i*height);
        i++;
        cxt.fillText('  炮转速：' + tank.gun.rot*180/Math.PI,x,y+i*height);
        i++;
        cxt.fillText('开火频率：' + parseInt(1/(tank.gun.timeout/1000)*100)/100 + ' 次/秒',x,y+i*height);
        i++;
        cxt.fillText('开火次数：' + tank.shoot + ' 次',x,y+i*height);
        i++;
        cxt.fillText('命中次数：' + tank.hit + ' 次',x,y+i*height);
        i++;
        cxt.fillText('  命中率：' + (parseInt(tank.hit/tank.shoot*10000)/100 || 0) + '%',x,y+i*height);
        i++;
        cxt.fillText('攻击范围：' + tank.gun.sight,x,y+i*height);
        i++;
        cxt.fillText('视野范围：' + tank.sight,x,y+i*height);
        i++;
        cxt.fillText('追击范围：' + tank.pursuitRange,x,y+i*height);
        i++;
        cxt.fillText('' ,x,y+i*height);
        i++;
        var hurtOut = tank.hurtOut;
        var hurtIn = tank.hurtIn;
        // console.log(hurtIn,hurtOut);
        for(var k in hurtOut){
            if(k == 'all'){
                cxt.fillText('输出总伤害：' + parseInt(hurtOut[k]*100)/100,x,y+i*height);
            }else{
                cxt.fillText('    对' + k + ' 的伤害：' + parseInt(hurtOut[k]*100)/100,x,y+i*height);
            }
            i++;
        }
        cxt.fillText('' ,x,y+i*height);
        i++;
        for(var k in hurtIn){
            if(k == 'all'){
                cxt.fillText('承受总伤害：' + parseInt(hurtIn[k]*100)/100,x,y+i*height);
            }else{
                cxt.fillText('     ' + k + ' 对自己的伤害：' + parseInt(hurtIn[k]*100)/100,x,y+i*height);
            }
            i++;
        }
        cxt.fillStyle = 'rgba(10,10,10,.5)';
        cxt.fillRect(x-16,y-height,260,(i+1)*height);
    }
};