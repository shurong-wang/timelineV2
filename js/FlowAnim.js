(function (window) {
	window.FlowAnim = function(fps){
		if(fps) {
			this.fps = fps;
		}
	}
	FlowAnim.prototype.animList = [];
	FlowAnim.prototype.fps = 60;
	FlowAnim.prototype.stop = function (index) {
		clearInterval(index);
		this.animList = this.animList.map(function (d) {
			return d != index;
		});
	}
	FlowAnim.prototype.start = function (render, fps) {
		return this.animList.push(setInterval(render, 1000/fps || this.fps));
	}
	FlowAnim.prototype.stopAll = function () {
		this.animList.forEach(function (d) {
			return clearInterval(d);
		})
		this.animList.splice(0);
	}
})(window);
