var cookie_name = '5vJPmPq2yRYT'; // クッキー名
var limit_days = 3; // カウントダウンの日数
var jump_url = 'https://lmagnet.xyz/?page_id=715'; // 時間切れの時にジャンプさせるURL

var first = 0;
var limit = 0;

var Hours = 0;
var Minutes = 0;
var Seconds = 0;
var Milli = 0;


$(function(){
    first = (new Date()).getTime();
    limit = first + (limit_days * 24 * 60 * 60 * 1000) - 1000;
    update_countdown();
});


/* 実際に表示を更新. 時間切れなら指定したURLに飛ばす. */
function update_countdown(){
    var diff = (limit - (new Date()).getTime());
	
    var	day = Math.floor(diff / (24 * 60 * 60 * 1000));
    var	hour = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    var	min = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 1000)) % 60;
    var	sec = Math.floor((diff % (24 * 60 * 60 * 1000)) / 1000) % 60 % 60;
    var	mili = Math.floor((diff % (24 * 60 * 60 * 1000)) / 10) % 100;
	
    // 時間切れチェック
    if (diff <= 0){
        // location.href = jump_url;
		 $('.countdown').html("<strong>終了準備中</strong>"); 
        return;
    }

//    var text = 'プレミアム動画公開終了まで<br><span class="time">残り' + day + '日' +  num_format(hour) + '時間' +  num_format(min) + '分' + num_format(sec) + '秒</span>';
    var text = '終了まで<br><span class="time">残り' + day + '日' +  num_format(hour) + '時間' +  num_format(min) + '分' + num_format(sec) + '秒</span>';
    $('.countdown').html(text); // 表示を更新

    setTimeout('update_countdown()', 100); // 10ms毎に更新
}

/* 数値を2桁に揃えるだけ */
function num_format(num){
		num = '00' + num;
		str = num.substring( num.length - 2, num.length );

		return str ;
		// num = '00' + num;
		// str = num.substring( num.length - 2, num.length );

		// ten = str.substr(0,1);
		// one = str.substr(1,1);

		// str = '<img src="images/' + ten + '.png">' + '<img src="images/' + one + '.png">';

		// return str ;
}