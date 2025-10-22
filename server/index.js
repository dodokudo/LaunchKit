#!/usr/bin/env node
'use strict';

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
app.use(express.json({ limit: '2mb' }));

const projectRoot = path.resolve(__dirname, '..');
const configsDir = path.join(projectRoot, 'configs');
const distDir = path.join(projectRoot, 'dist');

function listConfigFiles() {
  return fs.readdir(configsDir).then((files) => files.filter((f) => f.endsWith('.json')));
}

async function readConfig(slug) {
  const filePath = path.join(configsDir, `${slug}.json`);
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  const json = await fs.readJson(filePath);
  return { json, filePath };
}

app.get('/api/projects', async (req, res) => {
  try {
    const files = await listConfigFiles();
    const projects = await Promise.all(files.map(async (file) => {
      const data = await fs.readJson(path.join(configsDir, file));
      return {
        slug: data.slug || path.basename(file, '.json'),
        template: data.template || 'seminar/index.njk',
        title: data.meta?.title || '(no title)',
        countdownEnabled: Boolean(data.countdown?.enabled),
        stickyCtaEnabled: Boolean(data.sticky_cta?.enabled)
      };
    }));
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_list_projects' });
  }
});

app.get('/api/projects/:slug/config', async (req, res) => {
  try {
    const { slug } = req.params;
    const config = await readConfig(slug);
    if (!config) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json(config.json);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_read_config' });
  }
});

app.put('/api/projects/:slug/config', async (req, res) => {
  try {
    const { slug } = req.params;
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    payload.slug = slug;
    const filePath = path.join(configsDir, `${slug}.json`);
    await fs.outputJson(filePath, payload, { spaces: 2 });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_write_config' });
  }
});

app.post('/api/projects/:slug/build', async (req, res) => {
  try {
    const { slug } = req.params;
    const configPath = path.join('configs', `${slug}.json`);
    const scriptPath = path.join(projectRoot, 'scripts', 'build.js');
    execFile('node', [scriptPath, configPath], { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr || error.message);
        return res.status(500).json({ error: 'build_failed', detail: stderr || error.message });
      }
      res.json({ ok: true, output: stdout.trim() });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_run_build' });
  }
});

app.post('/api/projects/:slug/deploy', async (req, res) => {
  try {
    const { slug } = req.params;
    const distPath = path.join(distDir, slug);

    if (!(await fs.pathExists(distPath))) {
      return res.status(400).json({ error: 'not_built', message: '先にビルドしてください' });
    }

    const { spawn } = require('child_process');

    // Use Vercel (requires prior 'vercel link' in dist folder)
    const deployProcess = spawn('npx', ['vercel', '--prod', '--yes'], {
      cwd: distPath,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    deployProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    deployProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    deployProcess.on('close', async (code) => {
      if (finished) return;
      finished = true;

      if (code !== 0) {
        console.error('Deploy error:', stderr);
        return res.status(500).json({ error: 'deploy_failed', detail: stderr });
      }

      try {
        // Extract URL from output
        const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
        const deployUrl = urlMatch ? urlMatch[0] : null;

        if (!deployUrl) {
          return res.status(500).json({ error: 'url_not_found', detail: 'デプロイURLが見つかりませんでした' });
        }

        // Save deploy URL to config
        const configPath = path.join(configsDir, `${slug}.json`);
        const config = await fs.readJson(configPath);
        config.deploy_url = deployUrl;
        await fs.outputJson(configPath, config, { spaces: 2 });

        res.json({ ok: true, url: deployUrl, output: stdout });
      } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ error: 'failed_to_save_config' });
      }
    });

    // Set timeout
    setTimeout(() => {
      if (finished) return;
      finished = true;
      deployProcess.kill();
      res.status(500).json({ error: 'deploy_timeout', detail: 'デプロイがタイムアウトしました' });
    }, 120000); // 2 minutes

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_deploy' });
  }
});

app.get('/api/projects/:slug/url', async (req, res) => {
  try {
    const { slug } = req.params;
    const config = await readConfig(slug);
    if (!config) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ url: config.json.deploy_url || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_get_url' });
  }
});

app.post('/api/projects/:slug/archive', async (req, res) => {
  try {
    const { slug } = req.params;
    const scriptPath = path.join(projectRoot, 'scripts', 'archive.js');
    execFile('node', [scriptPath, slug], { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr || error.message);
        return res.status(500).json({ error: 'archive_failed', detail: stderr || error.message });
      }
      res.json({ ok: true, output: stdout.trim() });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_archive' });
  }
});

app.get('/api/projects/:slug/dist', async (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = path.join(distDir, slug, 'index.html');
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'not_built' });
    }
    const html = await fs.readFile(filePath, 'utf8');
    res.type('text/html').send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_read_dist' });
  }
});

app.post('/api/files', async (req, res) => {
  try {
    const { path: targetPath, content = '' } = req.body || {};
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'invalid_path' });
    }
    const resolved = path.resolve(projectRoot, targetPath);
    if (!resolved.startsWith(projectRoot)) {
      return res.status(400).json({ error: 'invalid_path_scope' });
    }
    await fs.outputFile(resolved, content);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_write_file' });
  }
});

app.post('/api/projects/:slug/html', async (req, res) => {
  try {
    const { path: htmlPath, content = '' } = req.body || {};
    if (!htmlPath || typeof htmlPath !== 'string') {
      return res.status(400).json({ error: 'invalid_path' });
    }
    const resolved = path.resolve(projectRoot, htmlPath);
    if (!resolved.startsWith(projectRoot)) {
      return res.status(400).json({ error: 'invalid_path_scope' });
    }
    await fs.outputFile(resolved, content, 'utf8');
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_write_html' });
  }
});

app.get('/api/html', async (req, res) => {
  try {
    const targetPath = req.query.path;
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'invalid_path' });
    }
    const resolved = path.resolve(projectRoot, targetPath);
    if (!resolved.startsWith(projectRoot)) {
      return res.status(400).json({ error: 'invalid_path_scope' });
    }
    if (!(await fs.pathExists(resolved))) {
      return res.json({ exists: false, content: '' });
    }
    const content = await fs.readFile(resolved, 'utf8');
    res.json({ exists: true, content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_read_html' });
  }
});

app.post('/api/projects/:slug/save-html-direct', async (req, res) => {
  try {
    const { slug } = req.params;
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'invalid_html' });
    }

    const distPath = path.join(distDir, slug, 'index.html');
    await fs.writeFile(distPath, html, 'utf8');

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed_to_save_html' });
  }
});

app.use('/admin', express.static(path.join(projectRoot, 'admin')));
app.use('/preview', express.static(distDir));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`LaunchKit admin server running on http://localhost:${port}`);
});
