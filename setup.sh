if [ $(whoami) != 'root' ]; then
echo "You have to execute this script as root user";
exit 1;
fi

if [ ! -f /etc/apache2/mods-enabled/proxy.load ]; then
    cp  /etc/apache2/mods-available/proxy.load /etc/apache2/mods-enabled/proxy.load;
fi

if [ ! -f /etc/apache2/mods-enabled/proxy_ftp.load ]; then
    cp  /etc/apache2/mods-available/proxy_ftp.load /etc/apache2/mods-enabled/proxy_ftp.load;
fi

if ! grep "ftp://ftp.mozilla.org/pub/mozilla.org/firefox" /etc/apache2/apache2.conf; then
echo "
ProxyPass /ftp ftp://ftp.mozilla.org/pub/mozilla.org/firefox
ProxyPassReverse /ftp ftp://ftp.mozilla.org/pub/mozilla.org/firefox
" >> /etc/apache2/apache2.conf;
fi
service apache2 restart;