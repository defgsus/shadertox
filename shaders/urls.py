# -*- coding: UTF-8 -*-
from __future__ import unicode_literals

from django.conf.urls import url

from . import views

app_name = "shaders"
urlpatterns = [
    url(r'^/?$',                                views.shader_list_view,         name='shader_list'),
    url(r'^edit/(?P<sid>[A-Z0-9]+)/?$',         views.shader_edit_view,         name='shader_edit'),
    url(r'^fork/(?P<sid>[A-Z0-9]+)/?$',         views.shader_fork_view,         name='shader_fork'),
    url(r'^newsourceid/(?P<sid>[A-Z0-9]+)/?$',  views.shader_new_source_id,     name='shader_new_source_id'),

    url(r'^load/(?P<sid>[A-Z0-9]+)/?$',         views.shader_load_json,         name='shader_load'),
    url(r'^save/(?P<sid>[A-Z0-9]+)/?$',         views.shader_save_json,         name='shader_save'),
]
