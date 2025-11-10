# 删除我的所有帖子

## 方法 1：通过浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 Console（控制台）标签
3. 复制并运行以下代码：

```javascript
fetch('/api/posts/admin/delete-my-posts', {
  method: 'DELETE',
  credentials: 'include',
})
  .then(res => res.json())
  .then(data => {
    console.log('删除结果:', data);
    if (data.success) {
      alert(`成功删除 ${data.deletedCount} 篇帖子！`);
      window.location.reload();
    } else {
      alert('删除失败: ' + data.message);
    }
  })
  .catch(error => {
    console.error('删除错误:', error);
    alert('删除失败: ' + error.message);
  });
```

## 方法 2：通过 curl 命令

```bash
curl -X DELETE http://localhost:3000/api/posts/admin/delete-my-posts \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

## 方法 3：通过 Postman 或其他 API 工具

- URL: `DELETE /api/posts/admin/delete-my-posts`
- 需要包含登录后的 session cookie

## 注意事项

- 此 API 会删除当前用户的所有帖子（通过 userID、email 或 name 匹配）
- 删除操作不可恢复，请谨慎使用
- 建议先备份数据

