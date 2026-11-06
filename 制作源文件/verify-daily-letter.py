"""Focused, side-effect-free checks for the generated daily-letter module."""
import ast
import importlib.util
import json
import re
import unittest
from copy import deepcopy
from html import escape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '制作源文件/experience_letter.py'


class Elements(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.tags = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class DailyLetterChecks(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SOURCE.exists(), 'The daily-letter renderer has not been implemented.')
        spec = importlib.util.spec_from_file_location('daily_letter_under_test', SOURCE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.places = json.loads((ROOT / '材料/旅行内容研究-景点.json').read_text('utf-8'))['places']
        self.foods = json.loads((ROOT / '材料/旅行内容研究-美食.json').read_text('utf-8'))['foods']
        self.photos = {p['id']: p for p in json.loads((ROOT / '材料/旅行照片/manifest.json').read_text('utf-8'))}
        # Load the actual photo helpers without running the page generator's writes.
        tree = ast.parse((ROOT / '制作源文件/build-travel-guide.py').read_text('utf-8-sig'))
        helpers = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in ('e', 'external', 'photo_figure', 'photo_credit')]
        self.helpers = {'esc': escape, 'photos': self.photos, 'food_photos': {}}
        exec(compile(ast.Module(body=helpers, type_ignores=[]), '<photo-helpers>', 'exec'), self.helpers)
        pairing_spec = importlib.util.spec_from_file_location('actual_pairings', ROOT / '制作源文件/experience_pairings.py')
        pairings_module = importlib.util.module_from_spec(pairing_spec)
        pairing_spec.loader.exec_module(pairings_module)
        self.pairings = pairings_module.pairing_data()

    def render(self):
        return self.module.render_daily_letter(self.places, self.foods, self.photos, self.pairings,
                                              self.helpers['photo_figure'], self.helpers['photo_credit'])

    def entries(self, markup):
        match = re.search(r'<script\b[^>]*id="daily-letter-data"[^>]*>(.*?)</script>', markup, re.S)
        self.assertIsNotNone(match, 'A safe local JSON payload is required for switching letters.')
        return json.loads(match.group(1))

    def test_static_letter_works_without_loading_the_whole_gallery(self):
        markup = self.render()
        tags = Elements(markup).tags
        self.assertEqual(sum(tag == 'img' for tag, _ in tags), 1)
        images = [attrs for tag, attrs in tags if tag == 'img']
        self.assertEqual(images[0]['loading'], 'lazy')
        button = next(attrs for tag, attrs in tags if tag == 'button' and 'data-daily-letter-next' in attrs)
        self.assertIn('hidden', button)
        self.assertIn('travel.html#place-longdi', markup)
        self.assertIn('food.html#food-duruan-bitter-melon', markup)

    def test_every_letter_retains_its_own_photo_and_source(self):
        entries = self.entries(self.render())
        self.assertEqual(len(entries), 20)
        self.assertEqual(len({entry['poem'] for entry in entries}), 20)
        for entry in entries:
            photo = self.photos[entry['id']]
            tags = Elements(entry['html']).tags
            image = next(attrs for tag, attrs in tags if tag == 'img')
            figure = next(attrs for tag, attrs in tags if tag == 'figure')
            self.assertEqual(image['alt'], photo['alt'])
            self.assertEqual(image['src'], photo['src'])
            self.assertEqual('preserve-photo' in figure['class'], bool(photo.get('preserve_full')))
            self.assertIn(escape(photo['caption'], quote=True), entry['html'])
            self.assertIn(escape(photo['source_url'], quote=True), entry['html'])
            if photo.get('required_credit'):
                self.assertIn(escape(photo['required_credit'], quote=True), entry['html'])

    def test_embedded_json_cannot_be_closed_by_content(self):
        self.places = deepcopy(self.places)
        self.places[0]['name'] = '风景</script><img src=x onerror=alert(1)>'
        markup = self.render()
        self.assertEqual(sum(tag == 'script' for tag, _ in Elements(markup).tags), 1)
        entries = self.entries(markup)
        self.assertEqual(entries[0]['name'], self.places[0]['name'])
        self.assertEqual(sum(tag == 'img' for tag, _ in Elements(markup).tags), 1)

    def test_cross_district_pairing_is_rejected(self):
        self.pairings['longdi'] = [{'foodId': 'waihai-noodles', 'note': '错误跨区搭配'}]
        with self.assertRaises(ValueError):
            self.render()


if __name__ == '__main__':
    unittest.main(verbosity=2)
