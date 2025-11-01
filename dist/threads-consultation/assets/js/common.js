$(function(){/* ページ内リンクをスムーズに  */

  $('a[href^="#"]').click(function(){
    var speed = 300;
    var href= $(this).attr("href");
    var target = $(href == "#" || href == "" ? 'html' : href);
    var position = target.offset().top;
    $("html, body").animate({scrollTop:position}, speed, "swing");
    return false;
  });
	
	
  let $pagetop = $('.flbtn');

  $(window).on( 'scroll', function () {
    //スクロール位置を取得
    if ( $(this).scrollTop() < 500 ) {
      $pagetop.css('opacity','0');
      $pagetop.css('display','none');
		
    } else {
      $pagetop.css('opacity','1');
      $pagetop.css('display','block');
    }
  });


});