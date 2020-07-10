jQuery(function($) {
  "use strict";

  function normalize(s) {
    return (s
      .toLowerCase() // convert to lower case
      .replace(/^\s+|\s+$/g, '') // strip leading/trailing whitespace
      .replace(/[^a-z0-9]+/g, ' ') // remove non-alphanumeric characters
    );
  }

  var TEMPLATES = Luigi.cache({
    find_list_css: [
      '#map-find-dialog .list-group-wrap[data-id="%{id}"] .list-group'
    ],

    find_row: [
      "<a ",
        "href='#' ",
        "class='list-group-item list-group-item-action' ",
        "title='%{name|h}' ",
        "data-id='%{id|h}' ",
        "data-name='%{name|h}' ",
        "data-q='%{q|h}' ",
      ">",
        "%{name|h}",
      "</a>",
    ],

    info_card_body: [
      "<div class='card-body'>",
        "<h6 class='card-title'>",
          "%{name|h}",
        "</h6>",

        "<p class='card-text'>",
          "TODO: stats",
        "</p>",
      "</div>",
    ],
  });

  var CONTROL_BAR_HTML = [
    "<div class='btn-toolbar ml-2 mt-1'>",
      "<div class='btn-group btn-group-sm mr-1'>",
        "<button ",
          "data-id='map-home' ",
          "class='btn btn-light border-dark shadow-sm' ",
          "title='Center map and reset zoom' ",
        ">",
          "<i class='fa fa-fw fa-home'></i>",
          // " ",
          // "Home",
        "</button>",
      "</div>",

      "<div class='btn-group btn-group-sm mr-2'>",
        "<button ",
          "class='btn btn-light border-dark shadow-sm'  ",
          "title='Find region by name.' ",
          "data-id='map-find' ",
          "data-toggle='modal' ",
          "data-target='#map-find-dialog' ",
        ">",
          "<i class='fa fa-fw fa-search'></i>",
          // " ",
          // "Find&hellip;",
        "</button>",
      "</div>",

      "<div class='btn-group btn-group-sm mr-2 hidden'>",
        "<button ",
          "data-id='map-reset' ",
          "class='btn btn-light' ",
          "title='Clear selections' ",
        ">",
          "Reset",
        "</button>",
      "</div>",
    "</div>",
  ].join('');

  L.Control.ControlBar = L.Control.extend({
    onAdd: function(map) {
      return $(CONTROL_BAR_HTML)[0];
    },
  });

  L.control.controlbar = function(opts) {
    return new L.Control.ControlBar(opts);
  };

  var INFO_CARD_HTML = [
    "<div class='card shadow p-0'>",
    "</div>",
  ].join('');

  L.Control.InfoCard = L.Control.extend({
    onAdd: function(map) {
      this._div = $(INFO_CARD_HTML)[0];
      this.update();
      return this._div;
    },

    update: function(feature) {
      var me = $(this._div);
      me.toggleClass('hidden', !feature);
      if (feature) {
        me.html(TEMPLATES.run('info_card_body', {
          name: feature.properties.NAME || feature.properties.name,
        }));
      }
    },
  });

  L.control.infocard = function(opts) {
    return new L.Control.InfoCard(opts);
  };

  // initialize Leaflet
  var map = L.map('map').setView([37.8, -96], 4);

  // add the OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: "&copy; <a href='https://openstreetmap.org/copyright'>OpenStreetMap contributors</a>"
  }).addTo(map);

  // load geojson data and create layers
  var geojson = { data: {}, layers: {} };
  [{
    id:   'states',
    url:  'data/us-states.json',
    show: true,

    normalize: function(feature) {
      var name = feature.properties.name;
      return {
        id: feature.id,
        name: name,
        q: normalize(name),
      };
    },
  }, {
    id:   'counties',
    url:  'data/us-counties-5m.json',

    normalize: function(feature) {
      var name = feature.properties.NAME;
      return {
        id:   feature.properties.GEOM_ID,
        name: name,
        q:    normalize(name),
      };
    },
  }].forEach(function(row) {
    fetch(row.url).then(r => r.json()).then(function(data) {
      // populate find list
      $(TEMPLATES.run('find_list_css', row)).html(data.features.map(
        f => TEMPLATES.run('find_row', row.normalize(f))
      ).join(''));

      // build map layer
      var layer = L.geoJson(data, {
        style: function(feature) {
          return {
            weight: 2,
            opacity: 1,
            strokeColor: 'white',
            dashArray: '3',
            fillOpacity: 0.3,
            // fillColor: '#0af',
            // fillColor: getColor(feature.properties.density)
          };
        },

        onEachFeature: function(feature, l) {
          l.on({
            mouseover: function(ev) {
              info.update(ev.target.feature);
              ev.target.setStyle({
                weight: 5,
                strokeColor: '#666',
                dashArray: '',
                fillOpacity: 0.7
              });
            },

            mouseout: function(ev) {
              info.update();
              // console.log(ev);
              layer.resetStyle(ev.target);
            },
          });
        },
      });

      geojson.data[row.id] = data;
      geojson.layers[row.id] = layer;

      return layer;
    }).then(function(layer) {
      if (row.show) {
        layer.addTo(map);
      }
    }).then(function() {
      var css = 'input[name="map-layer"][value="' + row.id + '"]';
      $(css).trigger('layer-loaded');
    });
  });

  var info = L.control.infocard({
    position: 'topright'
  }).addTo(map);

  L.control.controlbar({
    position: 'bottomleft'
  }).addTo(map);

  // show the scale bar on the lower left corner
  L.control.scale().addTo(map);

  $('#map').on('click', 'button[data-id="map-home"]', function() {
    map.setView([37.8, -96], 4);
    $(this).blur();
    return false;
  });

  $('input[name="map-layer"]').on('layer-loaded', function() {
    var me = $(this);
    me.prop('disabled', false);
    me.parent().find('.loading').addClass('hidden');
  }).click(function() {
    var id = $(this).val(),
        layer = geojson.layers[id];

    // remove existing layers
    for (var key in geojson.layers) {
      var tmp = geojson.layers[key];
      if (map.hasLayer(tmp)) {
        map.removeLayer(tmp);
      }
    }

    // add layer
    layer.addTo(map);
  });

  $('.dropdown-menu').on('click', 'a.dropdown-item', function() {
    var me = $(this),
        ul = me.parents('.dropdown-menu'),
        btn = ul.prev('.dropdown-toggle');

    console.log(me.data());

    // set highlight
    ul.find('.active').removeClass('active');
    me.addClass('active');

    // set name
    btn.find('span').text(me.data('name'));

    // hide dropdown
    $('body').click();

    // stop event
    return false;
  });

  $('#map-find-dialog').on('show.bs.modal', function() {
    var view = $('input[name="map-layer"]:checked');

    // reset list
    $(this).find('.list-group-wrap').addClass('hidden');
    $(this).find('.list-group-wrap[data-id="' + view.val() + '"]')
      .removeClass('hidden');

    // set title
    var title = view.data('name');
    $('#map-find-dialog-title span').text(title);

    // clear search field
    $('#map-find-q').val('');
    $(this).find('.list-group-item-action').removeClass('hidden');
  }).on('shown.bs.modal', function() {
    // focus search field
    $('#map-find-q').focus();
  }).on('hide.bs.modal', function() {
    // blur button
    $('#map button[data-id="map-find"]').blur();
  }).find('.list-group').on('click', '.list-group-item-action', function() {
    $(this).toggleClass('active');
    return false;
  });

  (function() {
    var timeout = null;

    $('#map-find-q').keydown(function(ev) {
      var me = $(this);

      if (ev.which != 13) {
        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(function() {
          // normalize query, split into parts
          var qs = normalize(me.val()).split(/[^a-z0-9]/);

          if (qs.length > 0) {
            $.each($('#map-find-dialog .list-group-item-action'), function(i, el) {
              var el_q = $(el).data('q') || '';
              $(el).toggleClass('hidden', ($.grep(qs, function(q) {
                return el_q.indexOf(q) != -1;
              }).length != qs.length));
            });
          } else {
            // no search string, show all values
            $('#map-find-dialog .list-group-item-action').removeClass('hidden');
          }
          timeout = null;
        }, 100);
      }
    });
  })();
});
