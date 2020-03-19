
# setup
clone CSSS COVID-19 repo

    cd data/
    ln -s path/to/COVID-19/csse_covid_19_data/cssee_covid_19_daily_reports csse-daily

# refresh data

Edit `bin/cron.sh` and set up cron/systemd/whatever to run it periodically
(hourly, daily, etc):

*TODO:*
* add `data/crontab.sample` and `data/post-receive.sample`
