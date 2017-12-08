# -*- coding: utf-8 -*-
# Generated by Django 1.11.7 on 2017-12-08 22:34
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import shaders.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Shader',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('shader_id', models.CharField(default=shaders.models.get_new_shader_id, max_length=10, verbose_name='shader id')),
                ('name', models.CharField(max_length=100, verbose_name='name')),
                ('forked_from', models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, to='shaders.Shader', verbose_name='forked from')),
            ],
        ),
        migrations.CreateModel(
            name='ShaderSource',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_id', models.CharField(default=shaders.models.get_new_source_id, max_length=10, verbose_name='shader id')),
                ('source_type', models.CharField(choices=[('vertex', 'vertex'), ('fragment', 'fragment'), ('include', 'include')], default='include', max_length=20, verbose_name='type')),
                ('name', models.CharField(max_length=100, verbose_name='name')),
                ('source', models.TextField(verbose_name='source')),
            ],
        ),
        migrations.CreateModel(
            name='ShaderStage',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stage_id', models.CharField(default=shaders.models.get_new_stage_id, max_length=10, verbose_name='stage id')),
                ('name', models.CharField(max_length=100, verbose_name='name')),
                ('index', models.IntegerField(default=0, verbose_name='index')),
                ('stage_type', models.CharField(choices=[('main', 'main'), ('buffer', 'buffer')], default='main', max_length=20, verbose_name='type')),
                ('shader', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='shaders.Shader', verbose_name='shader')),
            ],
        ),
        migrations.AddField(
            model_name='shadersource',
            name='stage',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='shaders.ShaderStage', verbose_name='shader stage'),
        ),
    ]